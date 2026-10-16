const EXERCISES = [

    'Basic ATM Simulation.c',
    'Basic Structure and Printing.c',
    'Basic Structure.c',
    'Book Reservation.c',
    'C to F.c',
    'Circle Area Calculator.c',
    'Cube Volume Finder.c',

    'Declaring Constant.c',
    'Escape Characters.c',
    'Invoice Generation.c',
    'Name Input.c',
    'Personal Information Display.c',
    'Personal Information.c',
    'Print Triangle.c',
    'Product Discount Calculator.c',

    'Rainbow Arch.c',
    'Rectangle Perimeter.c',
    'Starry Ascension.c',
    'Student Grade Averager.c',
    'User Welcome Banner.c',
    'Using scanf.c',
    'Variable Declaration and Types.c',
    'Wage Calculator.c'
];
let studentDatabase = [];
let exerciseData = {}; 
let currentFile = "";
let currentUser = "";

// Settings and Mode Management
let appSettings = {
    mode: 'exam', // 'practice' or 'exam'
    timerMinutes: 30
};

let timerIntervalId = null;
let timeRemaining = 0; // in seconds
let timerEndsAt = null;
let scoreModalShown = false;

const EXAM_STORAGE_PREFIX = 'complete-me:exam:';
const EXAM_STORAGE_VERSION = 1;

function getExamStorageKey(email = currentUser) {
    return `${EXAM_STORAGE_PREFIX}${encodeURIComponent(email.trim().toLowerCase())}`;
}

function getExerciseSignature(exercise) {
    const source = exercise.answers.map(options => options.join('\u001e')).join('\u001f');
    let hash = 2166136261;
    for (let index = 0; index < source.length; index++) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `${exercise.answers.length}:${hash >>> 0}`;
}

function readExamState() {
    if (appSettings.mode !== 'exam' || !currentUser) return null;
    try {
        const saved = JSON.parse(localStorage.getItem(getExamStorageKey()) || 'null');
        if (!saved || saved.version !== EXAM_STORAGE_VERSION) return null;
        if (saved.email.toLowerCase() !== currentUser.toLowerCase()) return null;
        return saved;
    } catch (error) {
        console.warn('Unable to read saved exam progress.', error);
        return null;
    }
}

function persistExamState() {
    if (appSettings.mode !== 'exam' || !currentUser) return;
    const exercises = {};
    for (const fileName of EXERCISES) {
        const exercise = exerciseData[fileName];
        if (!exercise) continue;
        exercises[fileName] = {
            signature: getExerciseSignature(exercise),
            userProgress: [...exercise.userProgress],
            score: exercise.score || 0,
            locked: !!exercise.locked,
            verifiedAt: exercise.verifiedAt || null
        };
    }
    try {
        localStorage.setItem(getExamStorageKey(), JSON.stringify({
            version: EXAM_STORAGE_VERSION,
            email: currentUser,
            timerMinutes: appSettings.timerMinutes,
            timerEndsAt,
            savedAt: new Date().toISOString(),
            exercises
        }));
    } catch (error) {
        console.warn('Unable to save exam progress.', error);
    }
}

function restoreExamProgress(savedState) {
    if (!savedState?.exercises) return;
    for (const fileName of EXERCISES) {
        const exercise = exerciseData[fileName];
        const saved = savedState.exercises[fileName];
        if (!exercise || !saved || saved.signature !== getExerciseSignature(exercise)) continue;
        if (!Array.isArray(saved.userProgress) || saved.userProgress.length !== exercise.userProgress.length) continue;
        exercise.userProgress = saved.userProgress.map(value => typeof value === 'string' ? value : '');
        exercise.score = Number.isInteger(saved.score)
            ? Math.max(0, Math.min(saved.score, exercise.answers.length))
            : 0;
        exercise.locked = !!saved.locked;
        exercise.verifiedAt = typeof saved.verifiedAt === 'string' ? saved.verifiedAt : null;
    }
}

window.onload = async function() {
    try {
        const res = await fetch('students.csv');
        const text = await res.text();
        const rows = text.split('\n').slice(1);
        studentDatabase = rows.map(row => {
            const [email, id] = row.split(',');
            return { email: email?.trim(), id: id?.trim() };
        });
    } catch (err) { console.error("Database failed to load."); }
};

async function handleLogin() {
    const email = document.getElementById('emailInput').value.trim();
    const id = document.getElementById('studentNumInput').value.trim();
    const user = studentDatabase.find(s => s.email === email && s.id === id);
    
    if (user) {
        currentUser = email;
        scoreModalShown = false;
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('userDisplay').textContent = email;
        const savedExamState = readExamState();
        await loadAllExercises(savedExamState);
        
        // Start timer if in exam mode
        if (appSettings.mode === 'exam') {
            if (Number.isInteger(savedExamState?.timerMinutes)) {
                appSettings.timerMinutes = savedExamState.timerMinutes;
            }
            if (checkIfAllAnswered()) {
                stopTimer();
                showScoreModal('complete');
            } else {
                startTimer(Number.isFinite(savedExamState?.timerEndsAt) ? savedExamState.timerEndsAt : null);
            }
        }
    } else {
        document.getElementById('loginError').textContent = "Invalid credentials.";
    }
}

async function loadAllExercises(savedExamState = null) {
    const list = document.getElementById('fileList');
    list.innerHTML = ""; 
    exerciseData = {};
    currentFile = "";
    document.getElementById('loader').style.display = 'block';

    for (const fileName of EXERCISES) {
        try {
            const res = await fetch('./exercises/' + fileName);
            const code = await res.text();
            exerciseData[fileName] = parseCCode(code);

            const li = document.createElement('li');
            const safeId = fileName.replace(/\./g, '-');
            li.id = `nav-${safeId}`;
            
            li.innerHTML = `
                <span>${fileName.replace('.c', '')}</span>
                <span class="nav-score" id="score-${safeId}">0/${exerciseData[fileName].answers.length}</span>
            `;
            
            li.onclick = () => switchExercise(fileName, li);
            list.appendChild(li);

        } catch (e) { console.warn("Missing: " + fileName); }
    }
    document.getElementById('loader').style.display = 'none';
    restoreExamProgress(savedExamState);
    for (const fileName of EXERCISES) updateSidebarScore(fileName);
    updateSummaryPanel();
    if (list.firstChild) list.firstChild.click();

    // Attach action button handler (delegates to verify or reset depending on locked state)
    document.getElementById('actionButton').addEventListener('click', () => {
        const actionBtn = document.getElementById('actionButton');
        const ex = exerciseData[currentFile];
        if (!currentFile) return;
        if (ex && ex.locked) {
            resetCurrentExercise();
        } else {
            checkAnswers();
        }
    });
}

function parseCCode(raw) {
    const answers = [];
    const userProgress = [];
    let i = 0;
    const inputs = [];
    
    // First, extract answers from brackets and replace with placeholders
    let html = raw;
    html = html.replace(/\[\[(.*?)\]\]/g, (match, content) => {
        const options = content.split('|').map(opt => opt.trim());
        answers.push(options);
        userProgress.push("");
        const displayWidth = options[0].length;
        const inputHtml = `<input type="text" data-idx="${i}" oninput="saveProgress(${i}, this.value)" class="code-input" style="width:${displayWidth + 1}ch">`;
        inputs.push(inputHtml);
        return `__INPUT_${i++}__`;
    });
    
    // Then, apply HTML encoding to the rest of the code
    html = html
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Finally, replace placeholders with actual input HTML
    inputs.forEach((input, idx) => {
        html = html.replace(`__INPUT_${idx}__`, input);
    });
    
    // Add score and locked state per exercise
    return { html, answers, userProgress, score: 0, locked: false, isPartial: false, verifiedAt: null };
}

function saveProgress(index, value) {
    if (exerciseData[currentFile]) {
        exerciseData[currentFile].userProgress[index] = value;
        persistExamState();
    }
}

function setInputsDisabled(disabled) {
    const inputs = document.querySelectorAll('.code-input');
    inputs.forEach(input => {
        input.disabled = disabled;
        if (disabled) {
            input.classList.add('locked');
            input.setAttribute('title', 'Locked');
        } else {
            input.classList.remove('locked');
            input.removeAttribute('title');
        }
    });
    const editor = document.querySelector('.code-editor');
    if (editor) {
        if (disabled) editor.classList.add('locked'); else editor.classList.remove('locked');
    }
}

function updateSidebarScore(file) {
    const safeId = file.replace(/\./g, '-');
    const scoreSpan = document.getElementById(`score-${safeId}`);
    const ex = exerciseData[file];
    if (!scoreSpan || !ex) return;
    scoreSpan.textContent = `${ex.score}/${ex.answers.length}`;
    
    // Remove all score classes first
    scoreSpan.classList.remove('completed-score', 'partial-score');
    
    // Add appropriate class based on score
    if (ex.score === ex.answers.length) {
        scoreSpan.classList.add('completed-score');  // 100% correct
    } else if (ex.score > 0) {
        scoreSpan.classList.add('partial-score');     // Partial correct
    }
    // If score is 0, keep default styling (unanswered)
}

function updateSummaryPanel() {
    let totalGot = 0;
    let totalPossible = 0;
    for (const file in exerciseData) {
        const ex = exerciseData[file];
        totalGot += Number(ex.score || 0);
        totalPossible += ex.answers.length;
    }
    const summaryValue = document.getElementById('summaryValue');
    const summaryPanel = document.getElementById('summaryPanel');
    if (summaryValue) summaryValue.textContent = `${totalGot} / ${totalPossible}`;
    if (summaryPanel) summaryPanel.classList.toggle('completed', totalPossible > 0 && totalGot === totalPossible);
}

function switchExercise(name, el) {
    currentFile = name;
    document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
    el.classList.add('active');
    
    document.getElementById('currentFileName').textContent = name;
    const display = document.getElementById('codeDisplay');
    display.innerHTML = exerciseData[name].html;

    const inputs = display.querySelectorAll('.code-input');
    inputs.forEach((input, index) => {
        input.value = exerciseData[name].userProgress[index];
    });

    // Restore disabled state and styles if previously verified (locked)
    const ex = exerciseData[name];
    if (ex.locked) {
        const inputs = display.querySelectorAll('.code-input');
        inputs.forEach((input, idx) => {
            const val = input.value.trim();
            if (ex.answers[idx].includes(val)) {
                input.style.borderBottomColor = "var(--secondary)";
            } else {
                input.style.borderBottomColor = "var(--error)";
            }
        });
        setInputsDisabled(true);
        
        // Only allow reset in practice mode
        if (appSettings.mode === 'practice') {
            document.getElementById('actionButton').textContent = 'Reset';
        } else {
            document.getElementById('actionButton').textContent = 'Locked';
            document.getElementById('actionButton').disabled = true;
        }
    } else {
        // Editable
        setInputsDisabled(false);
        display.querySelectorAll('.code-input').forEach(i => i.style.borderBottomColor = 'var(--secondary)');
        document.getElementById('actionButton').textContent = 'Verify Code';
        document.getElementById('actionButton').disabled = false;
    }

    updateSidebarScore(name);
    updateSummaryPanel();
    document.getElementById('feedback').textContent = "";
}

function checkAnswers() {
    if (!currentFile) return;
    const inputs = document.querySelectorAll('.code-input');
    const correctArr = exerciseData[currentFile].answers;
    let score = 0;

    inputs.forEach((input, index) => {
        const val = input.value.trim();
        if (correctArr[index].includes(val)) {
            input.style.borderBottomColor = "var(--secondary)";
            score++;
        } else {
            input.style.borderBottomColor = "var(--error)";
        }
    });

    // Lock inputs and mark exercise locked
    setInputsDisabled(true);
    exerciseData[currentFile].score = score;
    exerciseData[currentFile].locked = true;
    exerciseData[currentFile].isPartial = score > 0 && score < correctArr.length;
    exerciseData[currentFile].verifiedAt = new Date().toISOString();
    persistExamState();

    // Update Sidebar Score
    updateSidebarScore(currentFile);
    updateSummaryPanel();

    const msg = document.getElementById('feedback');
    if (score === correctArr.length) {
        msg.textContent = "✨ Perfect! Activity Complete! ✨";
        msg.style.color = "var(--secondary)";
        // Bigger & longer confetti
        triggerBigConfetti();
    } else {
        msg.textContent = `Progress: ${score}/${correctArr.length} correct.`;
        msg.style.color = "var(--text-main)";
    }

    // Change action button based on mode
    const actionBtn = document.getElementById('actionButton');
    if (appSettings.mode === 'exam') {
        actionBtn.textContent = 'Locked';
        actionBtn.disabled = true;
        
        // Check if all exercises have been answered in exam mode
        if (checkIfAllAnswered()) {
            // Stop timer early and show score summary
            stopTimer();
            setTimeout(() => {
                showScoreModal('complete');
            }, 500);
        }
    } else {
        actionBtn.textContent = 'Reset';
    }
}

function resetCurrentExercise() {
    if (!currentFile) return;
    
    // Prevent reset in exam mode
    if (appSettings.mode === 'exam') {
        showAlertModal('Reset Not Allowed', 'Reset is not allowed in Exam Mode.');
        return;
    }
    
    const ex = exerciseData[currentFile];
    ex.userProgress = ex.userProgress.map(() => "");
    ex.score = 0;
    ex.locked = false;
    ex.verifiedAt = null;

    // Clear UI inputs
    const display = document.getElementById('codeDisplay');
    const inputs = display.querySelectorAll('.code-input');
    inputs.forEach((input) => {
        input.value = '';
        input.style.borderBottomColor = 'var(--secondary)';
    });
    setInputsDisabled(false);

    // Update sidebar and summary
    updateSidebarScore(currentFile);
    updateSummaryPanel();

    // Reset feedback and action button
    document.getElementById('feedback').textContent = '';
    document.getElementById('actionButton').textContent = 'Verify Code';
    persistExamState();
}

function triggerConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6200ee', '#03dac6', '#ffca28']
    });
}

function triggerBigConfetti() {
    // Burst multiple waves for a bigger, longer celebration
    const colors = ['#6200ee', '#03dac6', '#ffca28', '#ff4081', '#00bcd4'];
    const bursts = [
        { particleCount: 300, spread: 120, startVelocity: 40 },
        { particleCount: 200, spread: 140, startVelocity: 30 },
        { particleCount: 150, spread: 160, startVelocity: 20 }
    ];

    let delay = 0;
    bursts.forEach(b => {
        setTimeout(() => {
            confetti(Object.assign({}, b, { origin: { y: 0.6 }, colors }));
        }, delay);
        delay += 500; // space the bursts
    });
}
function exportProgress() {
    let csv = "Student,Exercise,Score\n";
    for (const file in exerciseData) {
        let correct = 0;
        exerciseData[file].userProgress.forEach((val, idx) => {
            if (exerciseData[file].answers[idx].includes(val.trim())) correct++;
        });
        csv += `${currentUser},${file},${correct}/${exerciseData[file].answers.length}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentUser}_results.csv`;
    a.click();
}

// --- SETTINGS AND MODE MANAGEMENT ---
function openSettingsModal() {
    document.getElementById('settingsModal').style.display = 'block';
    document.getElementById('settingsOverlay').style.display = 'block';
    
    // Set current settings in the modal
    document.querySelector(`input[name="mode"][value="${appSettings.mode}"]`).checked = true;
    document.getElementById('timerInput').value = appSettings.timerMinutes;
    document.getElementById('timerValidationMessage').textContent = '';
    cancelClearSavedStudentProgress();
    updateClearProgressStatus();
    
    // Show/hide timer section based on mode
    const timerSection = document.getElementById('timerSection');
    if (appSettings.mode === 'exam') {
        timerSection.style.display = 'block';
    } else {
        timerSection.style.display = 'none';
    }
}

function closeSettingsModal() {
    cancelClearSavedStudentProgress();
    document.getElementById('settingsModal').style.display = 'none';
    document.getElementById('settingsOverlay').style.display = 'none';
}

function handleModeChange() {
    const selectedMode = document.querySelector('input[name="mode"]:checked').value;
    const timerSection = document.getElementById('timerSection');
    
    if (selectedMode === 'exam') {
        timerSection.style.display = 'block';
    } else {
        timerSection.style.display = 'none';
    }
}

function validateTimerInput(input) {
    let value = parseInt(input.value, 10);
    const validationMessage = document.getElementById('timerValidationMessage');
    
    if (isNaN(value)) {
        input.classList.add('invalid');
        if (validationMessage) validationMessage.textContent = 'Enter a timer value between 1 and 999 minutes.';
        return false;
    }
    
    if (value < 1) {
        input.value = '1';
        input.classList.remove('invalid');
    } else if (value > 999) {
        input.value = '999';
        input.classList.remove('invalid');
    } else {
        input.classList.remove('invalid');
    }
    if (validationMessage) validationMessage.textContent = '';
    
    return true;
}

function getSavedStudentProgressKeys() {
    const keys = [];
    try {
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (key?.startsWith(EXAM_STORAGE_PREFIX)) keys.push(key);
        }
    } catch (error) {
        console.warn('Unable to inspect saved student progress.', error);
    }
    return keys;
}

function updateClearProgressStatus(message = '', isError = false) {
    const status = document.getElementById('clearProgressStatus');
    const clearButton = document.getElementById('clearProgressBtn');
    if (!status || !clearButton) return;
    const count = getSavedStudentProgressKeys().length;
    status.textContent = message || (count === 0
        ? 'No student progress is saved in this browser.'
        : `${count} student record${count === 1 ? '' : 's'} saved in this browser.`);
    status.classList.toggle('error-text', isError);
    clearButton.disabled = count === 0;
}

function requestClearSavedStudentProgress() {
    const keys = getSavedStudentProgressKeys();
    if (keys.length === 0) {
        updateClearProgressStatus('No saved student progress to clear.');
        return;
    }

    const confirmation = document.getElementById('clearProgressConfirmation');
    const message = document.getElementById('clearProgressConfirmMessage');
    const confirmButton = document.getElementById('confirmClearProgressBtn');
    const recordLabel = `${keys.length} student record${keys.length === 1 ? '' : 's'}`;
    message.textContent = `This will permanently remove ${recordLabel} from this browser. This action cannot be undone.`;
    confirmButton.textContent = `Clear ${keys.length} record${keys.length === 1 ? '' : 's'}`;
    confirmation.hidden = false;
    document.getElementById('clearProgressBtn').disabled = true;
    confirmButton.focus();
}

function cancelClearSavedStudentProgress() {
    const confirmation = document.getElementById('clearProgressConfirmation');
    if (confirmation) confirmation.hidden = true;
    const clearButton = document.getElementById('clearProgressBtn');
    if (clearButton) clearButton.disabled = getSavedStudentProgressKeys().length === 0;
}

function confirmClearSavedStudentProgress() {
    const keys = getSavedStudentProgressKeys();
    if (keys.length === 0) {
        cancelClearSavedStudentProgress();
        updateClearProgressStatus('No saved student progress to clear.');
        return;
    }

    const recordLabel = `${keys.length} student record${keys.length === 1 ? '' : 's'}`;
    try {
        keys.forEach(key => localStorage.removeItem(key));
        cancelClearSavedStudentProgress();
        updateClearProgressStatus(`${recordLabel} cleared.`);
    } catch (error) {
        console.error('Unable to clear saved student progress.', error);
        cancelClearSavedStudentProgress();
        updateClearProgressStatus('Could not clear saved progress. Please try again.', true);
    }
}

function saveSettings() {
    const selectedMode = document.querySelector('input[name="mode"]:checked').value;
    const timerInput = document.getElementById('timerInput');
    const timerValue = parseInt(timerInput.value, 10);
    
    // Validate timer input
    if (selectedMode === 'exam') {
        if (isNaN(timerValue) || timerValue < 1 || timerValue > 999) {
            timerInput.classList.add('invalid');
            document.getElementById('timerValidationMessage').textContent = 'Enter a timer value between 1 and 999 minutes.';
            timerInput.focus();
            return;
        }
        appSettings.timerMinutes = timerValue;
    }
    
    appSettings.mode = selectedMode;

    if (currentUser) {
        if (appSettings.mode === 'exam') {
            startTimer();
        } else {
            stopTimer();
        }
    }
    closeSettingsModal();
    
    // Show toast notification
    showNotification(`Settings saved! Mode: ${selectedMode === 'exam' ? 'Exam (' + timerValue + ' min)' : 'Practice'}`);
}

function showNotification(message) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--primary);
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 2001;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Timer Management
function startTimer(savedEndTime = null) {
    if (appSettings.mode !== 'exam') {
        return;
    }
    stopTimer();
    timerEndsAt = Number.isFinite(savedEndTime)
        ? savedEndTime
        : Date.now() + appSettings.timerMinutes * 60 * 1000;
    const timerContainer = document.getElementById('timerContainer');
    timerContainer.style.display = 'flex';

    const tick = () => {
        timeRemaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            handleTimerExpired();
            return false;
        }
        return true;
    };

    persistExamState();
    if (tick()) timerIntervalId = setInterval(tick, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timerDisplay').textContent = display;
    
    const timerDisplay = document.getElementById('timerDisplay');
    timerDisplay.classList.remove('warning', 'critical');
    
    if (timeRemaining <= 60) {
        timerDisplay.classList.add('critical');
    } else if (timeRemaining <= 300) {
        timerDisplay.classList.add('warning');
    }
}

function stopTimer() {
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }
    const timerContainer = document.getElementById('timerContainer');
    timerContainer.style.display = 'none';
}

function handleTimerExpired() {
    stopTimer();
    
    // Lock all exercises
    for (const file in exerciseData) {
        if (!exerciseData[file].locked) {
            exerciseData[file].locked = true;
        }
    }
    persistExamState();
    setInputsDisabled(true);
    document.getElementById('actionButton').disabled = true;
    if (currentFile) {
        const currentNav = document.getElementById(`nav-${currentFile.replace(/\./g, '-')}`);
        if (currentNav) switchExercise(currentFile, currentNav);
    }
    updateSummaryPanel();
    showScoreModal('time');
}

// --- ALERT AND SCORE SUMMARY MODALS ---
function showAlertModal(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertModal').style.display = 'block';
    document.getElementById('alertOverlay').style.display = 'block';
}

function closeAlertModal() {
    document.getElementById('alertModal').style.display = 'none';
    document.getElementById('alertOverlay').style.display = 'none';
}

function calculateTotalScore() {
    let totalGot = 0;
    let totalPossible = 0;
    for (const file in exerciseData) {
        const ex = exerciseData[file];
        totalGot += Number(ex.score || 0);
        totalPossible += ex.answers.length;
    }
    return { got: totalGot, possible: totalPossible };
}

const QR_SHARED_PASSPHRASE = 'AA-9002341ds2sd14-dsfs12sd-54231hg';
const QR_SALT_STRING = 'java-activity-qr-salt-v1';
const QR_RESULTS_VIEWER_URL = 'https://mratamayo-tsatinc.github.io/qr/it5b-w4.html';
let scoreModalClockInterval = null;
let scoreSummaryDownloadInProgress = false;
let scoreQrGeneration = 0;

function formatScoreTimestamp(date) {
    const dayDate = date.toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const time = date.toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    return `${dayDate}  ·  ${time}`;
}

function tickScoreModalClock() {
    const clock = document.getElementById('scoreSummaryClock');
    if (clock) clock.textContent = formatScoreTimestamp(new Date());
}

function renderScoreSummaryContent() {
    const { got, possible } = calculateTotalScore();
    const earned = document.getElementById('scoreSummaryEarned');
    const maximum = document.getElementById('scoreSummaryMaximum');
    const total = document.getElementById('scoreSummaryTotal');
    const user = document.getElementById('scoreSummaryUser');
    const breakdown = document.getElementById('scoreBreakdown');

    if (earned) earned.textContent = got;
    if (maximum) maximum.textContent = possible;
    if (total) total.setAttribute('aria-label', `${got} out of ${possible} points`);
    if (user) user.textContent = currentUser || '—';
    tickScoreModalClock();

    if (!breakdown) return;
    breakdown.textContent = '';
    for (const fileName of EXERCISES) {
        const exercise = exerciseData[fileName];
        if (!exercise) continue;
        const row = document.createElement('div');
        row.className = 'score-summary-exercise-row';
        const name = document.createElement('span');
        name.className = 'sse-name';
        name.textContent = fileName.replace(/\.c$/i, '');
        const value = document.createElement('span');
        value.className = 'sse-value';
        const hasProgress = exercise.userProgress.some(answer => answer.trim() !== '');
        if (exercise.verifiedAt) {
            const percent = exercise.answers.length > 0
                ? Math.round((exercise.score / exercise.answers.length) * 100)
                : 0;
            value.textContent = `${exercise.score} / ${exercise.answers.length} · ${percent}%`;
        } else if (exercise.locked) {
            value.textContent = `0 / ${exercise.answers.length} · Not submitted`;
        } else if (hasProgress) {
            value.textContent = `0 / ${exercise.answers.length} · In progress`;
        } else {
            value.textContent = `0 / ${exercise.answers.length} · Not started`;
        }
        row.append(name, value);
        breakdown.appendChild(row);
    }
}

function openScoreModal() {
    showScoreModal('manual');
}

function showScoreModal(reason = 'manual') {
    const automatic = reason === 'complete' || reason === 'time';
    if (automatic && scoreModalShown) return;
    if (automatic) scoreModalShown = true;
    const modal = document.getElementById('scoreModal');
    if (!modal) return;
    modal.classList.toggle('score-summary-exam', appSettings.mode === 'exam');
    modal.style.display = 'flex';
    const status = document.getElementById('scoreSummaryDownloadStatus');
    if (status) status.textContent = '';
    renderScoreSummaryContent();
    if (scoreModalClockInterval !== null) clearInterval(scoreModalClockInterval);
    scoreModalClockInterval = setInterval(tickScoreModalClock, 1000);
    renderScoreSummaryQr();
}

function closeScoreModal() {
    if (scoreSummaryDownloadInProgress) return;
    const modal = document.getElementById('scoreModal');
    if (modal) modal.style.display = 'none';
    if (scoreModalClockInterval !== null) {
        clearInterval(scoreModalClockInterval);
        scoreModalClockInterval = null;
    }
}

function handleScoreModalBackdrop(event) {
    if (event.target === event.currentTarget) closeScoreModal();
}

async function deriveQrKey() {
    if (!window.crypto?.subtle) throw new Error('Secure QR encryption is unavailable in this browser.');
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(QR_SHARED_PASSPHRASE), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: encoder.encode(QR_SALT_STRING), iterations: 100000, hash: 'SHA-256' },
        keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
    );
}

function bufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function encryptQrPayload(payload) {
    const key = await deriveQrKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return bufferToBase64Url(combined);
}

function getCleanSourceUrl() {
    return window.location.href.split(/[?#]/)[0].replace(/^https?:\/\//i, '');
}

async function buildResultsShareUrl(score, maximum) {
    const token = await encryptQrPayload({
        e: currentUser, t: Math.floor(Date.now() / 1000), s: score, m: maximum
    });
    const url = new URL(QR_RESULTS_VIEWER_URL);
    url.searchParams.set('d', token);
    url.searchParams.set('a', getCleanSourceUrl());
    url.searchParams.set('n', document.title);
    return url.toString();
}

async function renderScoreSummaryQr() {
    const box = document.getElementById('scoreQrCodeBox');
    if (!box || !currentUser) return;
    const generation = ++scoreQrGeneration;
    box.innerHTML = '<span class="qr-loading">Preparing QR…</span>';
    try {
        if (typeof QRCode === 'undefined') throw new Error('The QR code component is unavailable.');
        const { got, possible } = calculateTotalScore();
        const shareUrl = await buildResultsShareUrl(got, possible);
        if (generation !== scoreQrGeneration) return;
        box.innerHTML = '';
        new QRCode(box, {
            text: shareUrl, width: 190, height: 190,
            colorDark: '#1a1a1a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.L
        });
    } catch (error) {
        console.error('Score QR generation failed:', error);
        if (generation === scoreQrGeneration) box.innerHTML = '<span class="qr-loading">QR code unavailable</span>';
    }
}

function scoreSummaryPngFilename(date) {
    const pad = value => String(value).padStart(2, '0');
    const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    return `complete-me-session-${timestamp}.png`;
}

async function downloadScoreSummaryPng() {
    if (scoreSummaryDownloadInProgress) return;
    const capture = document.querySelector('#scoreModal .score-card');
    const button = document.getElementById('scoreSummaryDownloadBtn');
    const buttonLabel = button?.querySelector('span');
    const status = document.getElementById('scoreSummaryDownloadStatus');
    if (!capture) return;
    scoreSummaryDownloadInProgress = true;
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    if (buttonLabel) buttonLabel.textContent = 'Preparing…';
    if (status) status.textContent = 'Preparing PNG…';
    try {
        if (typeof html2canvas !== 'function') throw new Error('The PNG export component is unavailable.');
        renderScoreSummaryContent();
        await renderScoreSummaryQr();
        if (document.fonts?.ready) await document.fonts.ready;
        const canvas = await html2canvas(capture, {
            backgroundColor: appSettings.mode === 'exam' ? '#103d6b' : '#ffffff',
            scale: 2, useCORS: true, logging: false,
            onclone: documentClone => documentClone.querySelector('#scoreModal .score-card')?.classList.add('score-summary-exporting')
        });
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG creation returned no image data.')), 'image/png');
        });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = scoreSummaryPngFilename(new Date());
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
        if (status) status.textContent = 'PNG downloaded.';
    } catch (error) {
        console.error('Score summary PNG export failed:', error);
        if (status) status.textContent = 'Could not download PNG. Please try again.';
    } finally {
        scoreSummaryDownloadInProgress = false;
        if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
        if (buttonLabel) buttonLabel.textContent = 'Download PNG';
    }
}

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('scoreModal')?.style.display === 'flex') {
        closeScoreModal();
    }
});

// Check if all exercises have been answered
function checkIfAllAnswered() {
    for (const file in exerciseData) {
        const ex = exerciseData[file];
        if (!ex.locked) {
            return false;
        }
    }
    return true;
}
