# Voice-Controlled To-Do List

A web application that lets you manage your to-do list entirely with voice commands. No typing required!

## Features

- **Voice Commands**: Add tasks, mark them as complete, and list your tasks using your voice
- **Hands-Free Operation**: Perfect for multitasking - add tasks while cooking, working out, or doing other activities
- **Pomodoro Timer**: Start a 25-minute timer for any task using voice commands
- **Speech Synthesis**: Get spoken feedback when you perform actions

## Voice Commands

- `Add task: [task name]` - Adds a new task to your list
- `Complete task: [task name]` - Marks a task as complete
- `List tasks` - Hear all your current tasks read aloud
- `Start Pomodoro for [task name]` - Starts a 25-minute timer for the specified task

## Browser Compatibility

This application uses the Web Speech API, which is best supported in Chrome and Edge browsers. Firefox and Safari may have limited or no support for speech recognition.

## How to Use

1. Open the application in a compatible browser (Chrome recommended)
2. Click the "Start Listening" button to begin voice recognition
3. Speak one of the supported commands
4. Click the button again to stop listening, or let it continue to recognize multiple commands

## Local Development

To run this application locally:

### Method 1: Direct File Open
1. Clone this repository
2. Open `index.html` directly in a web browser

### Method 2: Using the Node.js Server
1. Clone this repository
2. Install dependencies with `npm install`
3. Start the server with `npm start` or `npm run dev` (for hot reloading)
4. Open your browser to `http://localhost:3000`

## Technical Details

- Built with vanilla JavaScript, HTML, and CSS
- Uses the Web Speech API for speech recognition and synthesis
- Stores tasks in memory (no backend or database required)
- Fully responsive design that works on desktop and mobile devices

## Privacy Note

This app processes voice recognition in your browser using the Web Speech API. No audio data is sent to a server - all speech processing happens locally on your device. 