const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const exams = await mongoose.connection.db.collection('exams').find({ title: 'dgdfbg' }).toArray();
    console.log('Exams found:', exams.length);
    
    if (exams.length > 0) {
      const examId = exams[0]._id;
      const results = await mongoose.connection.db.collection('results').find({ examId: examId }).toArray();
      console.log('Results using direct _id match:', results.length);
      
      const stringResults = await mongoose.connection.db.collection('results').find({ examId: examId.toString() }).toArray();
      console.log('Results using String match:', stringResults.length);
      
      const allResultsForExam = await mongoose.connection.db.collection('results').find({
         $or: [
           { examId: examId },
           { examId: examId.toString() },
           { examId: mongoose.Types.ObjectId(examId) }
         ]
      }).toArray();
      console.log('Results using any match:', allResultsForExam.length, allResultsForExam.map(r => r.status));
    }
    
    const allResults = await mongoose.connection.db.collection('results').find({}).toArray();
    console.log('Total Results in DB globally:', allResults.length);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});
