const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const exams = await mongoose.connection.db.collection('exams').find({ title: 'dgdfbg' }).toArray();
    if (exams.length > 0) {
      const examId = exams[0]._id;
      const results = await mongoose.connection.db.collection('results').find({ examId: examId }).toArray();
      console.log('Results statuses:', results.map(r => r.status));
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});
