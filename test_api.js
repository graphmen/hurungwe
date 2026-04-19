const handler = require('./api/ndvi.js');
const dotenv = require('dotenv');
dotenv.config();

const req = {
    query: {
        start: '2023-01-01',
        end: '2023-01-31'
    }
};

const res = {
    setHeader: (k, v) => console.log(`Header: ${k}=${v}`),
    status: (code) => {
        console.log(`Status: ${code}`);
        return {
            json: (data) => console.log('JSON:', JSON.stringify(data, null, 2)),
            end: () => console.log('End')
        };
    }
};

handler(req, res).catch(err => {
    console.error('UNCAUGHT ERROR:', err);
});
