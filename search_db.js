const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.collections();
    
    for (let collection of collections) {
      const docs = await collection.find({
        $or: [
          { _id: "6a4405761ed36cc8fc2c0f7b" },
          { _id: new mongoose.Types.ObjectId("6a4405761ed36cc8fc2c0f7b") },
          { title: /6a4405761ed36cc8fc2c0f7b/ },
          { name: /6a4405761ed36cc8fc2c0f7b/ },
          { examId: "6a4405761ed36cc8fc2c0f7b" },
          { examId: new mongoose.Types.ObjectId("6a4405761ed36cc8fc2c0f7b") },
        ]
      }).toArray();
      
      if (docs.length > 0) {
        console.log(`Found in collection ${collection.collectionName}:`, docs);
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});
