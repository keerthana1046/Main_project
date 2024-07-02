const iconElement = document.querySelector(".weather-icon");
const tempElement = document.querySelector(".temp-value");
const descElement = document.querySelector(".temp-description");
const locationElement = document.querySelector(".location");
const notificationElement = document.getElementById("container");
const forecastCanvas = document.getElementById("forecast-chart");

const weather = {
    temperature: {
        value: undefined,
        unit: "celsius"
    },
    windSpeed: null,
    humidity: null,
    forecast: []
};

const Kelvin = 273;
const apiKey = '2a7077753c2b02bb7b854c980b57e133'; 

if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(setPosition, showError);
} else {
    getWeatherByCity('Delhi');
}

function setPosition(position) {
    const { latitude, longitude } = position.coords;
    getWeather(latitude, longitude);
}

function showError(error) {
    console.error('Error getting geolocation:', error);
    getWeatherByCity('Delhi');
}

function getWeather(latitude, longitude) {
    const api = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}`;
    fetchWeather(api);
}

function getWeatherByCity(city) {
    const api = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`;
    fetchWeather(api);
}

function fetchWeather(api) {
    console.log('Fetching weather data from:', api);
    fetch(api)
        .then(response => {
            if (!response.ok) {
                throw new Error('Weather data not available');
            }
            return response.json();
        })
        .then(data => {
            console.log('Weather data received:', data);
            weather.temperature.value = Math.floor(data.main.temp - Kelvin);
            weather.description = data.weather[0].description;
            weather.iconId = data.weather[0].icon;
            weather.city = data.name;
            weather.country = data.sys.country;
            weather.windSpeed = data.wind.speed;
            weather.humidity = data.main.humidity;

            // Fetch 7-day forecast data
            return fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(weather.city)}&appid=${apiKey}`);
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Forecast data not available');
            }
            return response.json();
        })
        .then(data => {
            const dailyForecast = aggregateDailyForecast(data.list);
            weather.forecast = dailyForecast.map(item => ({
                date: item.date,
                icon: item.weather[0].icon,
                temperature: Math.floor(item.temperature - Kelvin),
                humidity: item.humidity,
                description: item.weather[0].description
            }));

            displayWeather();
            displayForecastChart();
        })
        .catch(error => {
            console.error('Error fetching weather:', error);
            notificationElement.style.display = "block";
            notificationElement.innerHTML = `<p>Failed to fetch weather data. Please try again.</p>`;
        });
}

function aggregateDailyForecast(list) {
    const dailyForecast = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set hours to 0 for accurate date comparison

    // Iterate through the forecast data
    list.forEach(item => {
        const date = new Date(item.dt * 1000);
        date.setHours(0, 0, 0, 0); // Set hours to 0 for accurate date comparison

        // Include the next 7 days (from today to next 6 days)
        if (date >= today && dailyForecast.length < 8) { // Include today and next 7 days
            // Calculate the day index (0 for today, 1 for tomorrow, ...)
            const dayIndex = (date.getDay() - today.getDay() + 8) % 8;

            // Check if the date already exists in dailyForecast
            const existingForecastIndex = dailyForecast.findIndex(forecast => forecast.dayIndex === dayIndex);
            if (existingForecastIndex !== -1) {
                dailyForecast[existingForecastIndex].temperature += item.main.temp;
                dailyForecast[existingForecastIndex].humidity += item.main.humidity;
            } else {
                dailyForecast.push({
                    dayIndex: dayIndex,
                    temperature: item.main.temp,
                    humidity: item.main.humidity,
                    weather: item.weather[0].description,
                    icon: item.weather[0].icon,
                    date: date // Store the date object for use in chart
                });
            }
        }
    });

    dailyForecast.forEach(forecast => {
        forecast.temperature /= dailyForecast.length; // Average temperature for the day
        forecast.humidity /= dailyForecast.length; // Average humidity for the day
    });

    return dailyForecast;
}

function displayWeather() {
    iconElement.innerHTML = `<img src='https://openweathermap.org/img/w/${weather.iconId}.png' width="120px">`;
    tempElement.innerHTML = `${weather.temperature.value} °<span>C</span>`;
    descElement.innerHTML = weather.description;
    locationElement.innerHTML = `${weather.city}, ${weather.country}`;
    document.getElementById('wind').innerHTML = `Wind Speed: ${weather.windSpeed} m/s`;
    document.getElementById('humidity').innerHTML = `Humidity: ${weather.humidity}%`;

    const currentDate = new Date();
    const dateTimeString = currentDate.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    });
    document.getElementById('datetime').textContent = dateTimeString;
}

let chart = null; // Variable to hold the chart instance

function displayForecastChart() {
    if (chart) {
        chart.destroy(); // Destroy the previous chart instance if exists
    }

    const labels = [];
    const temperatures = [];
    const humidities = [];

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get labels and data for the chart from today to next 7 days
    for (let i = 0; i < 8; i++) { // Include today and next 7 days
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        const dateString = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        labels.push(dateString);

        if (i === 0) { // Today's weather
            temperatures.push(weather.temperature.value);
            humidities.push(weather.humidity);
        } else { // Forecasted data
            const forecastDay = weather.forecast.find(day => day.date.getDay() === date.getDay());
            if (forecastDay) {
                temperatures.push(forecastDay.temperature);
                humidities.push(forecastDay.humidity);
            } else {
                temperatures.push(null);
                humidities.push(null);
            }
        }
    }

    const ctx = forecastCanvas.getContext('2d');
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: temperatures,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                yAxisID: 'temp'
            },
            {
                label: 'Humidity (%)',
                data: humidities,
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                yAxisID: 'humidity'
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: false
                },
                temp: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                humidity: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Humidity (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            tooltips: {
                callbacks: {
                    label: function(tooltipItem, data) {
                        const datasetLabel = data.datasets[tooltipItem.datasetIndex].label || '';
                        return `${datasetLabel}: ${tooltipItem.value}`;
                    }
                }
            }
        }
    });
}

document.getElementById('getWeather').addEventListener('click', function () {
    const city = document.getElementById('city').value.trim();
    if (city) {
        getWeatherByCity(city);
    } else {
        alert('Please enter a city name');
    }
});
