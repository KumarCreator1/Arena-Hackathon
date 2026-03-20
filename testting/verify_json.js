
const fs = require('fs');

const filePath = '/home/adminvicky/Documents/dev/Project Parallax/testting/test-2DPPCC.json';

try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    console.log('JSON Parse Success');

    if (Array.isArray(json)) {
        console.log('Format: Array of Questions');
    } else if (json.questions && Array.isArray(json.questions)) {
        console.log('Format: Standard Exam Object');
        console.log('Config:', json.config);
        console.log('Questions Length:', json.questions.length);

        if (json.config && json.config.proctoring) {
            console.log('Proctoring found:', json.config.proctoring);
        } else {
            console.log('Proctoring not found in config');
        }

    } else {
        console.error('Format: INVALID - Not array and no questions array');
    }

} catch (err) {
    console.error('JSON Parse Error:', err.message);
}
