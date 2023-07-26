const express = require('express');
const app = express();
const port = 3000;


app.use(express.json());


const MongoClient = require('mongodb').MongoClient;
const uri = 'mongodb+srv://project:project1@cluster0.adlo8sm.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

let db;

client.connect((err) => {
  if (err) {
    console.error('Error connecting to MongoDB Atlas:', err);
    return;
  }
  db = client.db('blogApp');
  console.log('Connected to MongoDB Atlas');
});


const validateBlogId = (req, res, next) => {
  if (!req.body.blog_id) {
    res.status(400).json({ error: 'Blog ID is required' });
  } else {
    next();
  }
};


app.get('/blogs', async (req, res) => {
  try {
    const blogs = await db.collection('Blog').aggregate([
      {
        $lookup: {
          from: 'Ranking',
          localField: '_id',
          foreignField: 'blog_id',
          as: 'rankings',
        },
      },
      {
        $unwind: {
          path: '$rankings',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: { 'rankings.rank': 1 },
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          content: { $first: '$content' },
          author: { $first: '$author' },
          views: { $first: '$views' },
          likes: { $first: '$likes' },
          rankings: { $push: '$rankings.rank' },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          content: 1,
          author: 1,
          views: 1,
          likes: 1,
          rank: { $arrayElemAt: ['$rankings', 0] },
        },
      },
    ]).toArray();

    const totalBlogs = blogs.length;
    res.json({ totalBlogs, blogs });
  } catch (err) {
    console.error('Error retrieving blogs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/changeRanking', validateBlogId, async (req, res) => {
  const { blog_id, rank } = req.body;
  if (rank < 1 || rank > 100) {
    res.status(400).json({ error: 'Ranking should be between 1 and 100' });
    return;
  }

  try {
    const blog = await db.collection('Blog').findOne({ _id: blog_id });
    if (!blog) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }

    let ranking = await db.collection('Ranking').findOne({ blog_id });
    if (!ranking) {
      ranking = { blog_id, rank };
      await db.collection('Ranking').insertOne(ranking);
    } else {
      await db.collection('Ranking').updateOne({ blog_id }, { $set: { rank } });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error changing ranking:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(501).json({ error: 'Illegal request' });
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
