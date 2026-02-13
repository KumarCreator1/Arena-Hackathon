/**
 * Socket.io Connectivity Test
 * 
 * Run: node server/tests/socket-test.js
 * 
 * Tests:
 *  1. Connect to /exam namespace
 *  2. Emit JOIN_EXAM
 *  3. Receive EXAM_STATE confirmation  
 *  4. Connect to /admin namespace
 *  5. Admin receives stats
 *  6. Disconnect gracefully
 */

import { io } from 'socket.io-client';

const SERVER = 'http://localhost:5000';
const PASS = '✅';
const FAIL = '❌';
let passed = 0;
let total = 0;

function test(name, condition) {
    total++;
    if (condition) {
        passed++;
        console.log(`  ${PASS} ${name}`);
    } else {
        console.log(`  ${FAIL} ${name}`);
    }
}

async function runTests() {
    console.log('\n🧪 Socket.io Connectivity Tests\n');
    console.log('── /exam Namespace ──────────────────');

    // Test 1: Connect to /exam
    const examSocket = io(`${SERVER}/exam`, {
        transports: ['websocket'],
        autoConnect: false,
    });

    await new Promise((resolve, reject) => {
        examSocket.on('connect', () => {
            test('Connected to /exam namespace', true);
            resolve();
        });
        examSocket.on('connect_error', (err) => {
            test('Connected to /exam namespace', false);
            console.log(`    Error: ${err.message}`);
            reject(err);
        });
        examSocket.connect();
        setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    // Test 2: JOIN_EXAM and receive EXAM_STATE
    await new Promise((resolve) => {
        examSocket.on('exam:state', (data) => {
            test('Received EXAM_STATE after joining', true);
            test('EXAM_STATE contains examId', data.examId === 'test-exam-001');
            test('EXAM_STATE contains users array', Array.isArray(data.users));
            test('Users array includes self', data.users.some(u => u.userId === 'student-1'));
            resolve();
        });

        examSocket.emit('exam:join', {
            userId: 'student-1',
            examId: 'test-exam-001',
            device: 'laptop',
        });

        setTimeout(() => {
            test('Received EXAM_STATE after joining', false);
            resolve();
        }, 3000);
    });

    // Test 3: Connect to /admin
    console.log('\n── /admin Namespace ─────────────────');

    const adminSocket = io(`${SERVER}/admin`, {
        transports: ['websocket'],
        autoConnect: false,
    });

    await new Promise((resolve, reject) => {
        adminSocket.on('connect', () => {
            test('Connected to /admin namespace', true);
            resolve();
        });
        adminSocket.on('connect_error', (err) => {
            test('Connected to /admin namespace', false);
            reject(err);
        });
        adminSocket.connect();
        setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    // Test 4: Admin receives EXAM_STATE with stats on connect
    await new Promise((resolve) => {
        adminSocket.on('exam:state', (data) => {
            test('Admin received system stats', !!data.stats);
            test('Stats show 1 student connected', data.stats.students === 1);
            test('Stats show 1 active exam', data.stats.activeExams === 1);
            resolve();
        });

        setTimeout(() => {
            test('Admin received system stats', false);
            resolve();
        }, 3000);
    });

    // Test 5: Second student joins — admin should get notified
    console.log('\n── Cross-namespace Events ───────────');

    const student2 = io(`${SERVER}/exam`, {
        transports: ['websocket'],
    });

    await new Promise((resolve) => {
        adminSocket.on('exam:user_joined', (data) => {
            test('Admin notified of new student join', true);
            test('Notification contains userId', data.userId === 'student-2');
            test('Notification contains totalInRoom', data.totalInRoom === 2);
            resolve();
        });

        student2.on('connect', () => {
            student2.emit('exam:join', {
                userId: 'student-2',
                examId: 'test-exam-001',
                device: 'mobile',
            });
        });

        setTimeout(() => {
            test('Admin notified of new student join', false);
            resolve();
        }, 3000);
    });

    // Test 6: Student disconnects — admin should get notified
    await new Promise((resolve) => {
        adminSocket.on('exam:user_left', (data) => {
            test('Admin notified of student disconnect', true);
            test('Disconnect notification has userId', data.userId === 'student-2');
            resolve();
        });

        student2.disconnect();

        setTimeout(() => {
            test('Admin notified of student disconnect', false);
            resolve();
        }, 3000);
    });

    // Cleanup
    examSocket.disconnect();
    adminSocket.disconnect();

    // Summary
    console.log(`\n────────────────────────────────────`);
    console.log(`  Result: ${passed}/${total} tests passed`);
    console.log(`────────────────────────────────────\n`);

    process.exit(passed === total ? 0 : 1);
}

runTests().catch((err) => {
    console.error('Test runner error:', err.message);
    process.exit(1);
});
