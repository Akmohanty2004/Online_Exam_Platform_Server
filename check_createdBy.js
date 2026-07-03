const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/online_exam_platform').then(async () => {
  try {
    const exams = await mongoose.connection.db.collection('exams').find({ title: 'dgdfbg' }).toArray();
    if (exams.length > 0) {
      console.log('Exam createdBy:', exams[0].createdBy);
      
      const users = await mongoose.connection.db.collection('users').find({ role: 'teacher' }).toArray();
      console.log('Teachers in DB:', users.map(u => ({ id: u._id, email: u.email })));
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});
