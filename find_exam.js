const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const exams = await mongoose.connection.db.collection('exams').find({ _id: new mongoose.Types.ObjectId("6a4405761ed36cc8fc2c0f7b") }).toArray();
    console.log('Exam with this ID:', exams.length > 0 ? exams[0].title : 'Not found');
    
    // Also check if any exam title is literally that ID
    const examTitles = await mongoose.connection.db.collection('exams').find({ title: /6a44/ }).toArray();
    console.log('Exams with 6a44 in title:', examTitles.map(e => e.title));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});
