document.addEventListener('DOMContentLoaded', () => {
    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Your browser does not support speech recognition. Please use Chrome or Edge.');
        document.getElementById('startBtn').disabled = true;
        document.getElementById('statusMsg').textContent = 'Speech recognition not supported';
        return;
    }

    // Elements
    const startBtn = document.getElementById('startBtn');
    const statusMsg = document.getElementById('statusMsg');
    const statusIndicator = document.getElementById('statusIndicator');
    const taskList = document.getElementById('taskList');
    const taskCount = document.getElementById('taskCount');
    const pomodoroContainer = document.getElementById('pomodoroContainer');
    const timer = document.getElementById('timer');
    const timerTask = document.getElementById('timerTask');
    const stopTimerBtn = document.getElementById('stopTimerBtn');
    const micHelpBanner = document.getElementById('micHelpBanner');
    const dismissHelpBtn = document.getElementById('dismissHelpBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const confirmModal = document.getElementById('confirmModal');
    const cancelClearBtn = document.getElementById('cancelClearBtn');
    const confirmClearBtn = document.getElementById('confirmClearBtn');

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // Initialize speech synthesis
    const synth = window.speechSynthesis;

    // Feedback sounds
    const successSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3');
    const errorSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2007/2007-preview.mp3');
    
    // Adjust sound volumes
    successSound.volume = 0.3;
    errorSound.volume = 0.2;

    // Tasks array
    let tasks = [];
    let isListening = false;
    let pomodoroInterval = null;
    let timeLeft = 25 * 60; // 25 minutes in seconds
    let noSpeechTimeout = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    // Check if we should show the microphone help banner (hide if previously dismissed)
    if (localStorage.getItem('micHelpDismissed') === 'true') {
        micHelpBanner.classList.add('hidden');
    }

    // Restore tasks from local storage if available
    const savedTasks = localStorage.getItem('voiceTodoTasks');
    if (savedTasks) {
        try {
            tasks = JSON.parse(savedTasks);
        } catch (e) {
            console.error('Error parsing saved tasks:', e);
            tasks = [];
        }
    }

    // Check microphone access
    async function checkMicrophoneAccess() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Stop the stream immediately after getting access
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (err) {
            console.error('Microphone access error:', err);
            return false;
        }
    }

    // Event listeners
    startBtn.addEventListener('click', async () => {
        if (!isListening) {
            // Check microphone access before starting
            const hasMicAccess = await checkMicrophoneAccess();
            if (!hasMicAccess) {
                updateStatusMessage('Microphone access denied. Please allow microphone access in your browser settings.', 'error');
                playSound('error');
                alert('Please allow microphone access to use voice commands.');
                return;
            }
        }
        toggleListening();
    });
    
    // Add keyboard support for start button
    startBtn.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isListening) {
                // Check microphone access before starting
                const hasMicAccess = await checkMicrophoneAccess();
                if (!hasMicAccess) {
                    updateStatusMessage('Microphone access denied. Please allow microphone access in your browser settings.', 'error');
                    playSound('error');
                    alert('Please allow microphone access to use voice commands.');
                    return;
                }
            }
            toggleListening();
        }
    });
    
    stopTimerBtn.addEventListener('click', stopPomodoro);
    
    // Add keyboard support for stop timer button
    stopTimerBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            stopPomodoro();
        }
    });
    
    // Dismiss microphone help banner
    dismissHelpBtn.addEventListener('click', () => {
        micHelpBanner.classList.add('hidden');
        localStorage.setItem('micHelpDismissed', 'true');
    });
    
    // Add keyboard support for dismiss help button
    dismissHelpBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            micHelpBanner.classList.add('hidden');
            localStorage.setItem('micHelpDismissed', 'true');
        }
    });
    
    // Clear all tasks button
    clearAllBtn.addEventListener('click', () => {
        if (tasks.length > 0) {
            showClearConfirmation();
        } else {
            updateStatusMessage('No tasks to clear', 'error');
            playSound('error');
        }
    });
    
    // Add keyboard support for clear all button
    clearAllBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (tasks.length > 0) {
                showClearConfirmation();
            } else {
                updateStatusMessage('No tasks to clear', 'error');
                playSound('error');
            }
        }
    });
    
    // Show clear confirmation modal
    function showClearConfirmation() {
        confirmModal.classList.add('show');
        
        // Set focus on the first button in the modal
        cancelClearBtn.focus();
        
        // Store the element that had focus before opening the modal
        const previouslyFocused = document.activeElement;
        
        // Handle tab key to trap focus inside modal
        const handleTabKey = (e) => {
            // List of focusable elements in the modal
            const focusableElements = confirmModal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            // If tab key and shift key are pressed and the active element is the first element
            if (e.key === 'Tab' && e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus(); // Focus on the last element
            }
            
            // If only tab key is pressed and the active element is the last element
            if (e.key === 'Tab' && !e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus(); // Focus on the first element
            }
            
            // Close on escape key
            if (e.key === 'Escape') {
                confirmModal.classList.remove('show');
                previouslyFocused.focus(); // Return focus to previous element
            }
        };
        
        // Add event listener for keydown
        confirmModal.addEventListener('keydown', handleTabKey);
        
        // Setup cleanup function to be called when modal closes
        const cleanupModal = () => {
            confirmModal.removeEventListener('keydown', handleTabKey);
            previouslyFocused.focus(); // Return focus to previous element
        };
        
        // Add one-time event listeners for buttons
        const onCancelClick = () => {
            confirmModal.classList.remove('show');
            cleanupModal();
            cancelClearBtn.removeEventListener('click', onCancelClick);
            confirmClearBtn.removeEventListener('click', onConfirmClick);
        };
        
        const onConfirmClick = () => {
            clearAllTasks();
            confirmModal.classList.remove('show');
            showFeedbackMessage('All tasks cleared successfully', 'success');
            playSound('success');
            cleanupModal();
            cancelClearBtn.removeEventListener('click', onCancelClick);
            confirmClearBtn.removeEventListener('click', onConfirmClick);
        };
        
        // Replace existing event listeners
        cancelClearBtn.addEventListener('click', onCancelClick);
        confirmClearBtn.addEventListener('click', onConfirmClick);
    }
    
    // Handle clicking outside the modal to close it
    window.addEventListener('click', (event) => {
        if (event.target === confirmModal) {
            confirmModal.classList.remove('show');
        }
    });

    // Update status message with appropriate styling
    function updateStatusMessage(message, type = 'info') {
        if (type === 'listening') {
            statusIndicator.innerHTML = `<i class="fas fa-microphone-alt"></i> <span>${message}</span>`;
            statusIndicator.classList.add('listening');
        } else if (type === 'error') {
            statusIndicator.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${message}</span>`;
            statusIndicator.classList.remove('listening');
        } else if (type === 'success') {
            statusIndicator.innerHTML = `<i class="fas fa-check-circle"></i> <span>${message}</span>`;
            statusIndicator.classList.remove('listening');
        } else {
            statusIndicator.innerHTML = `<i class="fas fa-microphone"></i> <span>${message}</span>`;
            statusIndicator.classList.remove('listening');
        }
    }
    
    // Show temporary feedback message
    function showFeedbackMessage(message, type = 'success') {
        // Create feedback element if it doesn't exist
        let feedbackEl = document.getElementById('feedbackMessage');
        if (!feedbackEl) {
            feedbackEl = document.createElement('div');
            feedbackEl.id = 'feedbackMessage';
            feedbackEl.className = 'feedback-message';
            document.body.appendChild(feedbackEl);
        }
        
        // Set message and type
        feedbackEl.textContent = message;
        feedbackEl.className = `feedback-message ${type}`;
        feedbackEl.style.display = 'block';
        
        // Animate in
        setTimeout(() => {
            feedbackEl.classList.add('show');
        }, 10);
        
        // Fade out after 3 seconds
        setTimeout(() => {
            feedbackEl.classList.remove('show');
            setTimeout(() => {
                feedbackEl.style.display = 'none';
            }, 300);
        }, 3000);
    }
    
    // Play feedback sounds
    function playSound(type) {
        // Check if sounds are allowed
        const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
        if (!soundEnabled) return;
        
        if (type === 'success') {
            successSound.play().catch(err => console.error('Error playing sound:', err));
        } else if (type === 'error') {
            errorSound.play().catch(err => console.error('Error playing sound:', err));
        }
    }

    // Main functions
    function toggleListening() {
        if (isListening) {
            recognition.stop();
            isListening = false;
            startBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
            startBtn.classList.remove('listening');
            updateStatusMessage('Ready for command');
            
            // Clear any pending no-speech timeout
            if (noSpeechTimeout) {
                clearTimeout(noSpeechTimeout);
                noSpeechTimeout = null;
            }
            
            // Reset retry count when stopping manually
            retryCount = 0;
        } else {
            // Set a timeout to detect no-speech error
            noSpeechTimeout = setTimeout(() => {
                if (isListening) {
                    updateStatusMessage("Sorry, I didn't hear anything. Please try again.", 'error');
                    playSound('error');
                }
            }, 7000); // 7 second timeout to detect silence
            
            recognition.start();
            isListening = true;
            startBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Stop Listening';
            startBtn.classList.add('listening');
            updateStatusMessage('Listening...', 'listening');
        }
    }

    // Speech recognition events
    recognition.onresult = (event) => {
        // Clear the no-speech timeout if we got a result
        if (noSpeechTimeout) {
            clearTimeout(noSpeechTimeout);
            noSpeechTimeout = null;
        }
        
        // Reset retry count on successful recognition
        retryCount = 0;
        
        const command = event.results[0][0].transcript.toLowerCase().trim();
        updateStatusMessage(`Command: "${command}"`, 'listening');
        processCommand(command);
    };

    recognition.onend = () => {
        // Clear the no-speech timeout
        if (noSpeechTimeout) {
            clearTimeout(noSpeechTimeout);
            noSpeechTimeout = null;
        }
        
        if (isListening && retryCount < MAX_RETRIES) {
            // Auto restart listening if it was active
            recognition.start();
            
            // Set a new no-speech timeout
            noSpeechTimeout = setTimeout(() => {
                if (isListening) {
                    updateStatusMessage("Sorry, I didn't hear anything. Please try again.", 'error');
                    playSound('error');
                }
            }, 7000); // 7 second timeout to detect silence
        } else if (retryCount >= MAX_RETRIES) {
            // After several retries, stop listening
            isListening = false;
            startBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
            startBtn.classList.remove('listening');
            updateStatusMessage('Stopped listening after several attempts. Click to try again.', 'error');
            showFeedbackMessage('No speech detected. Please check your microphone.', 'error');
            playSound('error');
            retryCount = 0;
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        
        // Clear the no-speech timeout
        if (noSpeechTimeout) {
            clearTimeout(noSpeechTimeout);
            noSpeechTimeout = null;
        }
        
        // Handle specific errors
        if (event.error === 'no-speech') {
            updateStatusMessage("Sorry, I didn't hear anything. Please try again.", 'error');
            retryCount++;
            
            if (retryCount >= MAX_RETRIES) {
                isListening = false;
                startBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
                startBtn.classList.remove('listening');
                updateStatusMessage('No speech detected after several attempts. Try checking your microphone settings.', 'error');
                showFeedbackMessage('No speech detected. Please check your microphone.', 'error');
                playSound('error');
            }
        } else if (event.error === 'aborted') {
            updateStatusMessage('Listening stopped');
        } else if (event.error === 'network') {
            updateStatusMessage('Network error. Please check your internet connection.', 'error');
            showFeedbackMessage('Network error. Please check your connection.', 'error');
            playSound('error');
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            updateStatusMessage('Microphone access denied. Please allow microphone access.', 'error');
            showFeedbackMessage('Microphone access denied. Please check settings.', 'error');
            playSound('error');
            isListening = false;
            startBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
            startBtn.classList.remove('listening');
            
            // Show help banner if it was previously dismissed
            if (micHelpBanner.classList.contains('hidden')) {
                micHelpBanner.classList.remove('hidden');
            }
        } else {
            updateStatusMessage(`Error: ${event.error}`, 'error');
            showFeedbackMessage(`Speech recognition error: ${event.error}`, 'error');
            playSound('error');
        }
        
        // Don't reset listening state for no-speech errors until max retries
        if (event.error !== 'no-speech' || retryCount >= MAX_RETRIES) {
            isListening = false;
            startBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
            startBtn.classList.remove('listening');
        }
    };

    // Process voice commands
    function processCommand(command) {
        // Recurring task pattern
        const recurringPattern = /remind me to (.+) every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;
        const recurringMatch = command.match(recurringPattern);

        if (recurringMatch) {
            const taskName = recurringMatch[1].trim();
            const dayOfWeek = recurringMatch[2].toLowerCase();
            
            // Calculate next occurrence of the specified day
            const today = new Date();
            const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(dayOfWeek);
            const daysUntilTarget = (targetDay - today.getDay() + 7) % 7;
            const nextDate = addDays(today, daysUntilTarget);

            // Add task with recurring flag
            addTask(taskName, 'recurring', nextDate, {
                recurring: true,
                dayOfWeek: targetDay
            });

            let feedbackMsg = `Recurring task added: ${taskName} every ${dayOfWeek}`;
            updateStatusMessage(feedbackMsg, 'success');
            showFeedbackMessage(feedbackMsg, 'success');
            playSound('success');
            speak(feedbackMsg);
            return;
        }

        // Add task command with category and due date
        if (command.startsWith('add task')) {
            let taskName = command.slice(9).trim();
            let category = 'default';
            let dueDate = null;

            // Check for category
            const categoryMatch = taskName.match(/to ([\w\s]+) list:/i);
            if (categoryMatch) {
                category = categoryMatch[1].trim();
                taskName = taskName.replace(categoryMatch[0], '').trim();
            }

            // Check for due date
            const dateMatch = taskName.match(/by (tomorrow|next week|next month|[\w\s]+ \d{1,2}(?:st|nd|rd|th)?)/i);
            if (dateMatch) {
                const dateStr = dateMatch[1].trim();
                taskName = taskName.replace(/by .+$/, '').trim();
                
                // Parse the date
                try {
                    if (dateStr === 'tomorrow') {
                        dueDate = addDays(new Date(), 1);
                    } else if (dateStr === 'next week') {
                        dueDate = addDays(new Date(), 7);
                    } else if (dateStr === 'next month') {
                        dueDate = addDays(new Date(), 30);
                    } else {
                        dueDate = parse(dateStr, 'MMMM d', new Date());
                    }
                } catch (e) {
                    console.error('Error parsing date:', e);
                }
            }

            if (taskName) {
                addTask(taskName, category, dueDate);
                let feedbackMsg = `Task added: ${taskName}`;
                if (category !== 'default') {
                    feedbackMsg += ` to ${category} list`;
                }
                if (dueDate) {
                    feedbackMsg += ` due ${format(dueDate, 'MMMM d')}`;
                    // Create calendar event if due date is set
                    createCalendarEvent({ name: taskName, category, dueDate });
                }
                updateStatusMessage(feedbackMsg, 'success');
                showFeedbackMessage(feedbackMsg, 'success');
                playSound('success');
                speak(feedbackMsg);
            } else {
                updateStatusMessage("I couldn't understand the task name", 'error');
                showFeedbackMessage("Please specify a task name", 'error');
                playSound('error');
                speak("I couldn't understand the task name. Please try again with 'add task' followed by your task.");
            }
        }
        // Complete task command
        else if (command.startsWith('complete task')) {
            const taskName = command.slice(14).trim();
            if (taskName) {
                const completed = completeTask(taskName);
                if (completed) {
                    updateStatusMessage(`Task completed: ${taskName}`, 'success');
                    showFeedbackMessage(`Task completed: ${taskName}`, 'success');
                    playSound('success');
                    speak(`Task completed: ${taskName}`);
                } else {
                    updateStatusMessage(`Couldn't find task: ${taskName}`, 'error');
                    showFeedbackMessage(`Task not found: ${taskName}`, 'error');
                    playSound('error');
                    speak(`I couldn't find a task named ${taskName}. Please try again.`);
                }
            } else {
                updateStatusMessage("Please specify which task to complete", 'error');
                showFeedbackMessage("Task name not specified", 'error');
                playSound('error');
                speak("I couldn't understand which task to complete. Please try again with 'complete task' followed by the task name.");
            }
        }
        // List tasks command
        else if (command.includes('list tasks') || command.includes('list my tasks')) {
            updateStatusMessage('Listing tasks', 'success');
            listTasks();
            playSound('success');
        }
        // Start Pomodoro timer command
        else if (command.startsWith('start pomodoro')) {
            const taskName = command.slice(14).replace('for', '').trim();
            if (taskName) {
                startPomodoro(taskName);
                updateStatusMessage(`Pomodoro started: ${taskName}`, 'success');
                showFeedbackMessage(`Pomodoro started for: ${taskName}`, 'success');
                playSound('success');
                speak(`Starting Pomodoro timer for ${taskName}`);
            } else {
                updateStatusMessage("Please specify a task for the Pomodoro", 'error');
                showFeedbackMessage("Task name required for Pomodoro", 'error');
                playSound('error');
                speak("I couldn't understand which task to start the Pomodoro for. Please try again with 'start Pomodoro for' followed by the task name.");
            }
        }
        // Clear all tasks command
        else if (command.includes('clear all tasks') || command.includes('delete all tasks')) {
            if (tasks.length > 0) {
                updateStatusMessage("Confirm clear all tasks?", 'listening');
                speak("Are you sure you want to clear all tasks? Say 'yes' to confirm or 'no' to cancel.");
                
                // Set up a one-time listener for confirmation
                const originalContinuous = recognition.continuous;
                recognition.continuous = false;
                
                // Store the current onresult handler
                const originalOnResult = recognition.onresult;
                
                recognition.onresult = (event) => {
                    const response = event.results[0][0].transcript.toLowerCase().trim();
                    
                    if (response === 'yes' || response === 'confirm' || response === 'ok') {
                        clearAllTasks();
                        updateStatusMessage("All tasks cleared", 'success');
                        showFeedbackMessage("All tasks have been cleared", 'success');
                        playSound('success');
                        speak("All tasks have been cleared.");
                    } else {
                        updateStatusMessage("Clear all tasks cancelled", 'info');
                        showFeedbackMessage("Operation cancelled", 'info');
                        speak("Clear all tasks cancelled.");
                    }
                    
                    // Restore original event handlers
                    recognition.onresult = originalOnResult;
                    recognition.continuous = originalContinuous;
                };
            } else {
                updateStatusMessage("No tasks to clear", 'error');
                showFeedbackMessage("No tasks to clear", 'error');
                playSound('error');
                speak("You don't have any tasks to clear.");
            }
        }
        // Help command
        else if (command.includes('help') || command.includes('commands')) {
            updateStatusMessage("Showing available commands", 'success');
            playSound('success');
            speak("Available commands: Add task, Complete task, List tasks, Clear all tasks, and Start Pomodoro for a task.");
        }
        else {
            updateStatusMessage("Command not recognized", 'error');
            showFeedbackMessage("I don't understand that command", 'error');
            playSound('error');
            speak("I don't understand that command. Try saying 'add task', 'complete task', 'list tasks', 'clear all tasks', or 'start pomodoro'.");
        }
    }

    // Save tasks to localStorage
    function saveTasks() {
        localStorage.setItem('voiceTodoTasks', JSON.stringify(tasks));
    }
    
    // Clear all tasks function
    function clearAllTasks() {
        tasks = [];
        renderTasks();
        saveTasks();
        updateStatusMessage('All tasks cleared', 'success');
    }

    // Update task counter
    function updateTaskCount() {
        const activeTasks = tasks.filter(task => !task.completed).length;
        const totalTasks = tasks.length;
        
        if (totalTasks === 0) {
            taskCount.textContent = 'No tasks';
        } else if (activeTasks === 0) {
            taskCount.textContent = `All ${totalTasks} completed`;
        } else {
            taskCount.textContent = `${activeTasks} active, ${totalTasks - activeTasks} completed`;
        }
    }

    // Task management functions
    function addTask(taskName, category = 'default', dueDate = null, options = {}) {
        const task = {
            id: Date.now(),
            name: taskName,
            completed: false,
            category: category,
            dueDate: dueDate,
            createdAt: new Date().toISOString(),
            ...options
        };
        tasks.push(task);
        renderTasks();
        saveTasks();
    }

    function completeTask(taskName) {
        const taskIndex = tasks.findIndex(task => 
            task.name.toLowerCase().includes(taskName.toLowerCase()));
        
        if (taskIndex !== -1) {
            tasks[taskIndex].completed = true;
            tasks[taskIndex].completedAt = new Date().toISOString();
            renderTasks();
            saveTasks();
            return true;
        }
        return false;
    }

    function deleteTask(taskId) {
        tasks = tasks.filter(task => task.id !== taskId);
        renderTasks();
        saveTasks();
        showFeedbackMessage("Task deleted", 'success');
        playSound('success');
    }

    function renderTasks() {
        taskList.innerHTML = '';
        
        if (tasks.length === 0) {
            const emptyMsg = document.createElement('li');
            emptyMsg.textContent = 'No tasks yet. Say "Add task" to create one.';
            emptyMsg.className = 'empty-message';
            taskList.appendChild(emptyMsg);
            updateTaskCount();
            return;
        }
        
        // Group tasks by category
        const tasksByCategory = tasks.reduce((acc, task) => {
            if (!acc[task.category]) {
                acc[task.category] = [];
            }
            acc[task.category].push(task);
            return acc;
        }, {});
        
        // Sort tasks within each category: active first, then by due date, then by creation date
        Object.keys(tasksByCategory).forEach(category => {
            tasksByCategory[category].sort((a, b) => {
                if (a.completed !== b.completed) {
                    return a.completed ? 1 : -1;
                }
                if (a.dueDate && b.dueDate) {
                    return new Date(a.dueDate) - new Date(b.dueDate);
                }
                if (a.dueDate) return -1;
                if (b.dueDate) return 1;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        });
        
        // Render tasks by category
        Object.entries(tasksByCategory).forEach(([category, categoryTasks]) => {
            if (category !== 'default') {
                const categoryHeader = document.createElement('li');
                categoryHeader.className = 'category-header';
                categoryHeader.textContent = category;
                taskList.appendChild(categoryHeader);
            }
            
            categoryTasks.forEach(task => {
                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''} ${task.dueDate && isPast(task.dueDate) ? 'overdue' : ''}`;
                li.setAttribute('role', 'listitem');
                li.style.animation = 'fadeIn 0.3s ease';
                li.tabIndex = 0;
                
                // Checkbox
                const taskCheckbox = document.createElement('div');
                taskCheckbox.className = 'task-checkbox';
                taskCheckbox.setAttribute('role', 'checkbox');
                taskCheckbox.setAttribute('aria-checked', task.completed ? 'true' : 'false');
                taskCheckbox.setAttribute('aria-label', `Mark task ${task.name} as ${task.completed ? 'active' : 'completed'}`);
                taskCheckbox.tabIndex = 0;
                taskCheckbox.innerHTML = '<i class="fas fa-check"></i>';
                
                // Task content
                const taskContent = document.createElement('div');
                taskContent.className = 'task-content';
                
                const taskText = document.createElement('div');
                taskText.className = 'task-text';
                taskText.textContent = task.name;
                
                // Due date display
                if (task.dueDate) {
                    const dueDateText = document.createElement('div');
                    dueDateText.className = 'due-date';
                    const formattedDate = format(task.dueDate, 'MMM d');
                    dueDateText.innerHTML = `<i class="fas fa-calendar"></i> ${formattedDate}`;
                    taskContent.appendChild(dueDateText);
                }
                
                taskContent.appendChild(taskText);
                
                const taskActions = document.createElement('div');
                taskActions.className = 'task-actions';
                
                const completeBtn = document.createElement('button');
                completeBtn.className = 'complete-btn';
                completeBtn.innerHTML = '<i class="fas fa-check"></i>';
                completeBtn.title = task.completed ? 'Mark as active' : 'Mark as completed';
                completeBtn.setAttribute('aria-label', task.completed ? `Mark task ${task.name} as active` : `Mark task ${task.name} as completed`);
                
                completeBtn.addEventListener('click', () => {
                    const wasCompleted = task.completed;
                    task.completed = !task.completed;
                    
                    if (task.completed) {
                        task.completedAt = new Date().toISOString();
                        if (!wasCompleted) {
                            showFeedbackMessage(`Task completed: ${task.name}`, 'success');
                            playSound('success');
                        }
                    } else {
                        delete task.completedAt;
                        if (wasCompleted) {
                            showFeedbackMessage(`Task marked as active: ${task.name}`, 'success');
                            playSound('success');
                        }
                    }
                    
                    renderTasks();
                    saveTasks();
                });
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.title = 'Delete task';
                deleteBtn.setAttribute('aria-label', `Delete task ${task.name}`);
                
                deleteBtn.addEventListener('click', () => {
                    deleteTask(task.id);
                });
                
                // Add keyboard support for clicking the task item
                li.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        // Toggle completion status on Enter or Space
                        const wasCompleted = task.completed;
                        task.completed = !task.completed;
                        
                        if (task.completed) {
                            task.completedAt = new Date().toISOString();
                            if (!wasCompleted) {
                                showFeedbackMessage(`Task completed: ${task.name}`, 'success');
                                playSound('success');
                            }
                        } else {
                            delete task.completedAt;
                            if (wasCompleted) {
                                showFeedbackMessage(`Task marked as active: ${task.name}`, 'success');
                                playSound('success');
                            }
                        }
                        
                        renderTasks();
                        saveTasks();
                    } else if (e.key === 'Delete') {
                        // Delete the task when Delete key is pressed
                        deleteTask(task.id);
                    }
                });
                
                taskActions.appendChild(completeBtn);
                taskActions.appendChild(deleteBtn);
                
                li.appendChild(taskCheckbox);
                li.appendChild(taskContent);
                li.appendChild(taskActions);
                taskList.appendChild(li);
            });
        });
        
        updateTaskCount();
    }

    function listTasks() {
        if (tasks.length === 0) {
            speak("You don't have any tasks yet.");
            return;
        }
        
        const activeTasks = tasks.filter(task => !task.completed);
        const completedTasks = tasks.filter(task => task.completed);
        
        let message = '';
        
        if (activeTasks.length > 0) {
            message += `You have ${activeTasks.length} active task${activeTasks.length > 1 ? 's' : ''}: `;
            activeTasks.forEach(task => {
                message += task.name;
                if (task.category !== 'default') {
                    message += ` (${task.category})`;
                }
                if (task.dueDate) {
                    message += ` due ${format(task.dueDate, 'MMMM d')}`;
                }
                message += ', ';
            });
            message = message.slice(0, -2); // Remove last comma and space
        } else {
            message += "You don't have any active tasks. ";
        }
        
        if (completedTasks.length > 0) {
            message += ` And ${completedTasks.length} completed task${completedTasks.length > 1 ? 's' : ''}.`;
        }
        
        speak(message);
    }

    // Pomodoro timer functions
    function startPomodoro(taskName) {
        // Reset timer
        clearInterval(pomodoroInterval);
        timeLeft = 25 * 60;
        updateTimerDisplay();
        
        // Show pomodoro container
        pomodoroContainer.classList.add('active');
        timerTask.textContent = `Working on: ${taskName}`;
        
        // Start countdown
        pomodoroInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft <= 0) {
                clearInterval(pomodoroInterval);
                showFeedbackMessage(`Pomodoro finished for: ${taskName}`, 'success');
                playSound('success');
                speak(`Pomodoro finished for task: ${taskName}`);
                pomodoroContainer.classList.remove('active');
            }
        }, 1000);
    }
    
    function stopPomodoro() {
        clearInterval(pomodoroInterval);
        pomodoroContainer.classList.remove('active');
        showFeedbackMessage("Pomodoro timer stopped", 'info');
        speak("Pomodoro timer stopped");
    }
    
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Speech synthesis function
    function speak(text) {
        // Cancel any ongoing speech
        synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        synth.speak(utterance);
    }

    // Add tips to help with microphone usage
    updateStatusMessage('Click "Start Listening" and speak clearly');

    // Initialize the UI
    renderTasks();

}); 