document.addEventListener('DOMContentLoaded', () => {
    fetch('http://localhost:3000/api/temperature')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('temperature-container');
            container.innerHTML = ''; // Clear existing content

            data.forEach(item => {
                const tempElement = document.createElement('div');
                tempElement.className = 'temperature-item';
                tempElement.innerHTML = `
                    <p>Temperature: ${item.temperature}°C</p>
                    <p>Recorded at: ${new Date(item.recorded_at).toLocaleString()}</p>
                `;
                container.appendChild(tempElement);
            });
        })
        .catch(error => console.error('Error fetching data:', error));
});





function updateClock() {
    const now = new Date();
    const options = { timeZone: 'Asia/Tokyo', hour12: false };
    const time = now.toLocaleTimeString('ja-JP', options);
    document.getElementById('clock').textContent = time;
}

setInterval(updateClock, 1000);
updateClock();