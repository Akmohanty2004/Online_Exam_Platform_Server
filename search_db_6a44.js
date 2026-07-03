const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const db = mongoose.connection.db;
    const examsCollection = db.collection('exams');
    const questionsCollection = db.collection('questions');

    const examId = new mongoose.Types.ObjectId("6a440c32afe214e01b0f63e7");
    
    const exam = await examsCollection.findOne({ _id: examId });
    console.log("Exam found:", exam);

    const questions = await questionsCollection.find({ examId: examId }).toArray();
    console.log(`Questions found for this exam: ${questions.length}`);
    if(questions.length > 0) {
      console.log(questions);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});
