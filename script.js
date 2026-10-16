const EXERCISES = [
    // EASY - Simple initialization / single blank
    'Basic ATM Simulation.c',
    'Basic Structure and Printing.c',
    'Basic Structure.c',
    'Book Reservation.c',
    'C to F.c',
    'Circle Area Calculator.c',
    'Cube Volume Finder.c',

    // MEDIUM - Operator or increment blanks
    'Declaring Constant.c',
    'Escape Characters.c',
    'Invoice Generation.c',
    'Name Input.c',
    'Personal Information Display.c',
    'Personal Information.c',
    'Print Triangle.c',
    'Product Discount Calculator.c',

    // HARD - Multiple blanks
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
    timerMinutes: 60
};

let timerIntervalId = null;
let timeRemaining = 0; // in seconds

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

function handleLogin() {
    const email = document.getElementById('emailInput').value.trim();
    const id = document.getElementById('studentNumInput').value.trim();
    const user = studentDatabase.find(s => s.email === email && s.id === id);
    
    if (user) {
        currentUser = email;
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('userDisplay').textContent = email;
        loadAllExercises();
        
        // Start timer if in exam mode
        if (appSettings.mode === 'exam') {
            startTimer();
        }
    } else {
        document.getElementById('loginError').textContent = "Invalid credentials.";
    }
}

async function loadAllExercises() {
    const list = document.getElementById('fileList');
    list.innerHTML = ""; 
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

            // Initialize sidebar score and summary
            updateSidebarScore(fileName);
            updateSummaryPanel();
        } catch (e) { console.warn("Missing: " + fileName); }
    }
    document.getElementById('loader').style.display = 'none';
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
    return { html, answers, userProgress, score: 0, locked: false, isPartial: false };
}

function saveProgress(index, value) {
    if (exerciseData[currentFile]) {
        exerciseData[currentFile].userProgress[index] = value;
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
    document.getElementById('summaryValue').textContent = `${totalGot} / ${totalPossible}`;
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
                showScoreSummaryModal('Congratulations! All exercises completed before time ran out!', 'success');
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
    
    // Show/hide timer section based on mode
    const timerSection = document.getElementById('timerSection');
    if (appSettings.mode === 'exam') {
        timerSection.style.display = 'block';
    } else {
        timerSection.style.display = 'none';
    }
}

function closeSettingsModal() {
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
    
    if (isNaN(value)) {
        input.classList.add('invalid');
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
    
    return true;
}

function saveSettings() {
    const selectedMode = document.querySelector('input[name="mode"]:checked').value;
    const timerInput = document.getElementById('timerInput');
    const timerValue = parseInt(timerInput.value, 10);
    
    // Validate timer input
    if (selectedMode === 'exam') {
        if (isNaN(timerValue) || timerValue < 1 || timerValue > 999) {
            alert('Please enter a valid timer value between 1 and 999 minutes.');
            return;
        }
        appSettings.timerMinutes = timerValue;
    }
    
    appSettings.mode = selectedMode;
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
function startTimer() {
    if (appSettings.mode !== 'exam') {
        return;
    }
    
    timeRemaining = appSettings.timerMinutes * 60; // Convert to seconds
    const timerContainer = document.getElementById('timerContainer');
    timerContainer.style.display = 'flex';
    
    updateTimerDisplay();
    
    timerIntervalId = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timerIntervalId);
            handleTimerExpired();
        }
    }, 1000);
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
    setInputsDisabled(true);
    document.getElementById('actionButton').disabled = true;
    
    // Show score summary modal
    showScoreSummaryModal('Time is up! Your exam session has ended.', 'warning');
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

function showScoreSummaryModal(completionMessage, messageType = 'success') {
    const { got, possible } = calculateTotalScore();
    
    document.getElementById('finalScore').textContent = got;
    document.getElementById('maxScore').textContent = possible;
    document.getElementById('summaryEmail').textContent = currentUser;
    
    const messageElement = document.getElementById('completionMessage');
    messageElement.textContent = completionMessage;
    messageElement.className = `completion-message ${messageType}`;
    
    document.getElementById('scoreSummaryModal').style.display = 'block';
    document.getElementById('scoreSummaryOverlay').style.display = 'block';
}

function closeSummaryModal() {
    document.getElementById('scoreSummaryModal').style.display = 'none';
    document.getElementById('scoreSummaryOverlay').style.display = 'none';
}

// Check if all exercises have been answered
function checkIfAllAnswered() {
    for (const file in exerciseData) {
        const ex = exerciseData[file];
        if (!ex.locked || ex.score === 0) {
            return false;
        }
    }
    return true;
}