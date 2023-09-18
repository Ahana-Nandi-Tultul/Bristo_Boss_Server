const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Boss is sitting');
})


// verify jWT
const verifyJWT = (req, res, next) => {
  // console.log("authorization header", req.headers.authorization)
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error: true, message: 'unauthorized access'});
  }
  const token = authorization.split(' ')[1];
  // console.log("jwt token:", token)
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if(error){
      // console.log("error", error)
     return res.status(401).send({error: true, message: 'unauthorized access'});
    }
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.epxwefd.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.post('/jwt', async(req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn : '1hr'});
  res.send({token});
})

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuCollection = client.db('bristDB').collection('menu');
    const userCollection = client.db('bristDB').collection('users');
    const reviewCollection = client.db('bristDB').collection('reviews');
    const cartCollection = client.db('bristDB').collection('cart');

    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = {email : email};
        const user = await userCollection.findOne(query);
        // console.log(user);
        if(user?.role !== 'admin'){
          return res.status(403).send({error: true, message: 'forbidden access'})
        }
        next();
    }
    
    // users
    app.get('/users', verifyJWT, verifyAdmin, async(req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.post('/users', async(req, res) => {
      const user = req.body;
      const query = {email: user.email}
      // console.log(user);
      const existingUser = await userCollection.find(query).toArray();
      if(existingUser.length > 0){
        return res.send({message: 'user already exist'});
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // is Admin
    app.get('/users/admin/:email', verifyJWT, async(req, res) => {
      const email = req.params.email;
      const query = {email : email}
      console.log("is admin: ", req.decoded.email, email)
      if(req.decoded.email !== email){
        return res.send({admin : false})
      }
      const user = await userCollection.findOne(query);
      console.log(user);
      const result = {admin: user?.role === 'admin'};
      res.send(result);
    })

    app.patch('/users/admin/:id', async(req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set : {
          role : 'admin'
        }
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // menu
    app.get('/menu', async(req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

    app.post('/menu',verifyJWT, verifyAdmin, async(req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    })

    // reviews
    app.get('/reviews', async(req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })

    // cart
    app.get('/carts', verifyJWT, async(req, res) => {
      const email = req.query.email;
      if(!email){
        res.send([])
      }

      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error: true, message: 'forbidden access'});
      }
      const query = {email : email};
      const result = await cartCollection.find(query).toArray();
      res.send(result)
    })
    app.post('/carts', async(req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    })

    app.delete('/carts/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log('Boss is sitting on port: ', port);
})