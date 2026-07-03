const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const exam = await mongoose.connection.db.collection('exams').findOne({ _id: new mongoose.Types.ObjectId('6a440c32afe214e01b0f63e7') });
    console.log("Exam Title:", exam?.title);
    console.log("Exam Status:", exam?.status);
    
    const questions = await mongoose.connection.db.collection('questions').find({ examId: new mongoose.Types.ObjectId('6a440c32afe214e01b0f63e7') }).toArray();
    console.log("Questions Count:", questions.length);
    if (questions.length > 0) {
      console.log("First question:", questions[0]);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});
