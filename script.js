const eggContainer = document.getElementById('egg-container');
const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');
const cooldownTimer = document.getElementById('cooldown-timer');
const timerDisplay = document.getElementById('timer');
const liveFeed = document.getElementById('live-feed');
const finalMessageDiv = document.getElementById('final-message');
const countdownDiv = document.getElementById('countdown');
const MAX_EGGS_ON_SCREEN = 10;
const gameTimerDisplay = document.getElementById('game-timer'); // Get the game timer element

// --- CONFIGURATION ---
const eventStartTimeString = '2025-03-28 11:16 PM'; //Date time and am/pm you want
const eventDuration = 60 * 60 * 1000;
const targetTimeZone = 'America/Los_Angeles';
const eggImagePaths = [
    'images/egg_red.png', 'images/egg_blue.png', 'images/egg_green.png', 'images/egg_yellow.png'
];
const eggCounts = {
    'Gold': 5,
    'Silver': 10,
    'Bronze': 20,
    'Bad egg': 15
};
const cooldownSeconds = 45;
const maxEggsPerUser = 2;
const googleSheetId = '1VjRP4q3rTIaU_tcloeBGvMarwbpz1Jf4Y9efCCy-C2w';
const finalMessage = "The Easter Egg Hunt is over! Thanks for playing!  Collect your prizes from [Location] between [Time] and [Time].";

// --- STATE VARIABLES ---
let eggsHatchedByType = {
    'Gold': 0,
    'Silver': 0,
    'Bronze': 0,
    'Bad egg': 0
};
let userEggCount = {};
let cooldownActive = false;
let eventRunning = false;
let startTime;
let availableEggs = [];  // Array to hold the available egg elements (unhatched)
let gameTimerInterval; // Variable to store the game timer interval

// User Data
let userEmail = '';
let userFullName = '';
let advisoryTeacher = '';

// --- UTILITY FUNCTIONS ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function getRandomEggType() {
    let availableEggTypes = [];
    for (const type in eggCounts) {
        const remaining = eggCounts[type] - eggsHatchedByType[type];
        for (let i = 0; i < remaining; i++) {
            availableEggTypes.push(type);
        }
    }

    if (availableEggTypes.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * availableEggTypes.length);
    return availableEggTypes[randomIndex];
}

function startCooldown() {
    cooldownActive = true;
    cooldownTimer.style.display = 'block';
    let timeLeft = cooldownSeconds;
    timerDisplay.textContent = timeLeft;

    const timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            cooldownActive = false;
            cooldownTimer.style.display = 'none';
        }
    }, 1000);
}

function addLiveFeedMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('feed-message');
    messageElement.textContent = message;
    liveFeed.appendChild(messageElement);

    messageElement.style.display = 'block';
    messageElement.style.opacity = 0;
    let opacity = 0;
    const fadeInterval = setInterval(() => {
        opacity += 0.1;
        messageElement.style.opacity = opacity;
        if (opacity >= 1) {
            clearInterval(fadeInterval);
        }
    }, 50);

    setTimeout(() => {
        let opacity = 1;
        const fadeOutInterval = setInterval(() => {
            opacity -= 0.1;
            messageElement.style.opacity = opacity;
            if (opacity <= 0) {
                clearInterval(fadeOutInterval);
                messageElement.style.display = 'none';
                liveFeed.removeChild(messageElement);
            }
        }, 50);
    }, 10000);
}

function sendDataToGoogleSheets(eggType) {
    const data = {
        email: userEmail,
        fullName: userFullName,
        advisoryTeacher: advisoryTeacher,
        eggType: eggType
    };

    const formData = new FormData();
    for (const key in data) {
        formData.append(key, data[key]);
    }

    fetch(`https://script.google.com/macros/s/AKfycbwGeAyOlOdasKNvtRCXNgcz2nqOvP3zhnb39AkL40S8a244J0nFOzTtIZxOTjNO58yfMg/exec`, {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                console.error('Error sending data to Google Sheets:', response.status);
            }
            return response.json();
        })
        .then(data => {
            if (data.result === 'success') {
                console.log('Data sent successfully to Google Sheets!');
            } else {
                console.error('Error from Google Apps Script:', data.error);
            }
        })
        .catch(error => {
            console.error('Error sending data to Google Sheets:', error);
        });
}

function endGame() {
    eventRunning = false;
    eggContainer.style.display = 'none';
    finalMessageDiv.textContent = finalMessage;
    finalMessageDiv.style.display = 'block';
    clearInterval(gameTimerInterval); // Stop the game timer
    gameTimerDisplay.textContent = "";
}

function checkEventStatus() {
    const nowUTC = moment.utc();
    const nowPST = nowUTC.clone().tz(targetTimeZone);
    const eventStartTimePST = eventStartTimeUTC.clone().tz(targetTimeZone);
    const eventEndTimePST = eventStartTimeUTC.clone().tz(targetTimeZone).add(eventDuration, 'ms');

    let totalHatched = 0;
    for (const type in eggsHatchedByType) {
        totalHatched += eggsHatchedByType[type];
    }

    if (nowPST < eventStartTimePST) {
        console.log('Event is not yet running.');
        eggContainer.style.display = 'none';
        finalMessageDiv.style.display = 'none';
        loginForm.style.display = 'none';
        gameTimerDisplay.textContent = "";
        clearInterval(gameTimerInterval);
        startCountdown();
        return false;
    } else if (nowPST > eventEndTimePST || totalHatched >= getTotalEggsAvailable()) {
        console.log('Event has ended.');
        endGame();
        return false;
    } else {
        console.log('Event is running.');
        countdownDiv.textContent = '';
        return true;
    }
}

function createEggs() {
    eggContainer.innerHTML = ''; // Clear existing eggs
    availableEggs = []; // Clear existing available eggs

    let totalEggsToCreate = getTotalEggsAvailable();

    for (let i = 0; i < totalEggsToCreate; i++) {
        const egg = document.createElement('button');
        egg.classList.add('egg');
        egg.style.backgroundImage = `url('${eggImagePaths[i % eggImagePaths.length]}')`;
        egg.addEventListener('click', handleEggClick);
        availableEggs.push(egg);  // Add to the available eggs array
    }

    displayEggs();  // Call displayEggs to show initial set of eggs
}

function displayEggs() {
    eggContainer.innerHTML = ''; // Clear the egg container

    let numEggsToDisplay = Math.min(availableEggs.length, MAX_EGGS_ON_SCREEN);  // Display at most MAX_EGGS_ON_SCREEN

    shuffleArray(availableEggs); // Shuffle the eggs so it's not always the same ones

    for (let i = 0; i < numEggsToDisplay; i++) {
        eggContainer.appendChild(availableEggs[i]); // Add the eggs to the container
    }
}

function handleEggClick(event) {
    if (!eventRunning) {
        alert("The egg hunt is not currently active.");
        return;
    }

    if (cooldownActive) {
        alert("Please wait for the cooldown to finish.");
        return;
    }

    if (userEggCount[userEmail] >= maxEggsPerUser) {
        alert("You have already hatched the maximum number of eggs.");
        return;
    }

    const eggType = getRandomEggType();

    if (eggType === null) {
        alert("All eggs have been hatched!");
        return;
    }

    eggsHatchedByType[eggType]++;

    userEggCount[userEmail] = (userEggCount[userEmail] || 0) + 1;

    addLiveFeedMessage(`${userFullName.split(' ')[0]} hatched a ${eggType} egg!`);

    sendDataToGoogleSheets(eggType);
    startCooldown();

    // Remove the clicked egg
    const clickedEgg = event.target;
    clickedEgg.remove();
    removeEggFromAvailableEggs(clickedEgg);

    // Display new eggs to maintain the limit
    displayEggs();
}

function getTotalEggsAvailable() {
    let total = 0;
    for (const type in eggCounts) {
        total += eggCounts[type];
    }
    return total;
}

function startCountdown() {
    function updateCountdown() {
        const nowUTC = moment.utc();
        const nowPST = nowUTC.clone().tz(targetTimeZone);
        const eventStartTimePST = eventStartTimeUTC.clone().tz(targetTimeZone);
        const timeLeft = eventStartTimePST.valueOf() - nowPST.valueOf();

        if (timeLeft <= 0) {
            countdownDiv.textContent = "The hunt has begun!";
            clearInterval(countdownInterval);
            loginForm.style.display = 'block';
            startTime = eventStartTimeUTC.toDate();
            eventRunning = checkEventStatus();
            return;
        }

        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        countdownDiv.textContent = `Starts in: ${days}d ${hours}h ${minutes}m ${seconds}s (PST)`;
    }

    updateCountdown();
    const countdownInterval = setInterval(updateCountdown, 1000);
}

function startGameTimer() {
    const eventEndTimeUTC = moment.tz(startTime, 'UTC').add(eventDuration, 'ms'); //End time in UTC
    const eventEndTimePST = eventEndTimeUTC.clone().tz(targetTimeZone);

    function updateGameTimer() {
        const nowUTC = moment.utc();
        const nowPST = nowUTC.clone().tz(targetTimeZone);
        const timeLeft = eventEndTimePST.valueOf() - nowPST.valueOf();

        if (timeLeft <= 0) {
            clearInterval(gameTimerInterval);
            gameTimerDisplay.textContent = "Time's up!"; // Display on the game timer element
            endGame();
            return;
        }

        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        gameTimerDisplay.textContent = `Time Left: ${hours}h ${minutes}m ${seconds}s (PST)`; // Display on the game timer element
    }

    updateGameTimer();
    gameTimerInterval = setInterval(updateGameTimer, 1000);
}

// Use the AM/PM format for the start time

const eventStartTimeUTC = moment.tz(eventStartTimeString, 'YYYY-MM-DD HH:mm A', 'UTC'); //Date time and am/pm you want

loginButton.addEventListener('click', function () {
    userEmail = document.getElementById('email').value;
    userFullName = document.getElementById('fullName').value;
    advisoryTeacher = document.getElementById('advisoryTeacher').value;

    if (!userEmail || !userFullName || !advisoryTeacher) {
        alert('Please fill out all fields.');
        return;
    }

    if (!userEggCount[userEmail]) {
        userEggCount[userEmail] = 0;
    }

    loginForm.style.display = 'none';
    eggContainer.style.display = 'flex';
    createEggs();

    startTime = eventStartTimeUTC.toDate();
    eventRunning = checkEventStatus();

    //Start Game Time
    startGameTimer();

    setInterval(function () {
        if (!eventRunning) {
            eventRunning = checkEventStatus();
            if (eventRunning) {
                eggContainer.style.display = 'flex';
                createEggs();
            }
        } else {
            checkEventStatus();
        }
    }, 60000);

});

document.addEventListener('DOMContentLoaded', function () {
    eggContainer.style.display = 'none';
    finalMessageDiv.style.display = 'none';

    startTime = eventStartTimeUTC.toDate();
    eventRunning = checkEventStatus();

    if (!eventRunning) {
        checkEventStatus();
    }
});

function removeEggFromAvailableEggs(eggToRemove) {
    availableEggs = availableEggs.filter(egg => egg !== eggToRemove);
}