const numbersContainer = document.getElementById('numbers');
const generateBtn = document.getElementById('generate-btn');

function generateNumbers() {
    numbersContainer.innerHTML = '';
    const numbers = [];
    while (numbers.length < 6) {
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

generateBtn.addEventListener('click', generateNumbers);

// Initial message
numbersContainer.innerHTML = '<p>Click the button to generate numbers</p>';
