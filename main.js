const numbersContainer = document.getElementById('numbers');
const generateBtn = document.getElementById('generate-btn');
const themeToggle = document.getElementById('checkbox');

function generateNumbers() {
    numbersContainer.innerHTML = '';
    const numbers = [];
    while (numbers.length < 5) {
        const randomNumber = Math.floor(Math.random() * 45) + 1;
        if (!numbers.includes(randomNumber)) {
            numbers.push(randomNumber);
        }
    }
    numbers.sort((a, b) => a - b);
    for (const number of numbers) {
        const numberDiv = document.createElement('div');
        numberDiv.classList.add('number');
        numberDiv.textContent = number;
        numbersContainer.appendChild(numberDiv);
    }
}

function setTheme(isDarkMode) {
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.checked = false;
        localStorage.setItem('theme', 'light');
    }
}

themeToggle.addEventListener('change', (e) => {
    setTheme(e.target.checked);
});

generateBtn.addEventListener('click', generateNumbers);

// Initial message
numbersContainer.innerHTML = '<p>Click the button to generate numbers</p>';

// Load theme preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    setTheme(true);
} else {
    setTheme(false);
}
