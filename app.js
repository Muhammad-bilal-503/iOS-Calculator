// Calculator State
let currentExpression = '';
let currentMode = 'basic'; // 'basic', 'scientific', 'notes'
let angleMode = 'DEG'; // 'DEG' or 'RAD'
let currentTheme = 'dark';
let lastResult = null;

// Drawing State
let isDrawing = false;
let currentTool = 'pen';
let currentColor = '#000000';
let currentStrokeWidth = 3;
let canvas, ctx;

// DOM Elements
const expressionDisplay = document.getElementById('expression');
const resultDisplay = document.getElementById('result');
const themeToggleBtn = document.getElementById('themeToggle');
const modeSwitchBtn = document.getElementById('modeSwitch');
const basicMode = document.getElementById('basicMode');
const scientificMode = document.getElementById('scientificMode');
const mathNotesMode = document.getElementById('mathNotesMode');

// Initialize theme from system preference
function initializeTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    currentTheme = prefersDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-color-scheme', currentTheme);
    updateThemeIcon();
}

// Theme Toggle
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-color-scheme', currentTheme);
    updateThemeIcon();
    
    // Update canvas background for notes mode
    if (currentMode === 'notes' && ctx) {
        redrawCanvas();
    }
}

function updateThemeIcon() {
    const themeIcon = document.querySelector('.theme-icon');
    themeIcon.textContent = currentTheme === 'light' ? '🌙' : '☀️';
}

// Mode Switching
function switchMode() {
    const modes = ['basic', 'scientific', 'notes'];
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    currentMode = modes[nextIndex];
    
    // Hide all modes
    basicMode.classList.remove('active');
    scientificMode.classList.remove('active');
    mathNotesMode.classList.remove('active');
    
    // Show active mode
    if (currentMode === 'basic') {
        basicMode.classList.add('active');
        document.querySelector('.mode-icon').textContent = '🔢';
    } else if (currentMode === 'scientific') {
        scientificMode.classList.add('active');
        document.querySelector('.mode-icon').textContent = '🔬';
    } else if (currentMode === 'notes') {
        mathNotesMode.classList.add('active');
        document.querySelector('.mode-icon').textContent = '✏️';
        initializeCanvas();
    }
}

// Angle Mode Toggle (Scientific Mode Only)
function toggleAngleMode() {
    angleMode = angleMode === 'DEG' ? 'RAD' : 'DEG';
    const angleModeText = document.getElementById('angleModeText');
    if (angleModeText) {
        angleModeText.textContent = angleMode;
    }
}

// Display Update Functions
function updateDisplay() {
    expressionDisplay.textContent = currentExpression || '0';
}

function updateResult(value) {
    resultDisplay.textContent = value;
    resultDisplay.classList.remove('error');
}

function showError(message) {
    resultDisplay.textContent = message;
    resultDisplay.classList.add('error');
}

// Input Handler
function handleInput(value) {
    // Handle special cases
    if (value === 'pi') {
        currentExpression += Math.PI;
    } else if (value === 'e') {
        currentExpression += Math.E;
    } else if (value === '10^') {
        currentExpression += '10^(';
    } else if (value === '1/') {
        currentExpression += '1/(';
    } else if (value === 'EE') {
        // Scientific notation (E notation)
        currentExpression += 'E';
    } else if (value === 'rand') {
        // Random number between 0 and 1
        currentExpression += Math.random().toFixed(10);
    } else {
        currentExpression += value;
    }
    updateDisplay();
    if (currentMode === 'scientific') {
        calculateResult();
    }
}

// Handle Button Actions
function handleAction(action) {
    switch(action) {
        case 'clear':
            clearAll();
            break;
        case 'delete':
            deleteLast();
            break;
        case 'negate':
            negateNumber();
            break;
        case 'equals':
            executeCalculation();
            break;
        case 'clear-canvas':
            clearCanvas();
            break;
    }
}

// Clear Functions
function clearAll() {
    currentExpression = '';
    lastResult = null;
    updateDisplay();
    updateResult('');
}

function deleteLast() {
    currentExpression = currentExpression.slice(0, -1);
    updateDisplay();
    if (currentExpression && currentMode === 'scientific') {
        calculateResult();
    } else if (!currentExpression) {
        updateResult('');
    }
}

function negateNumber() {
    if (!currentExpression) return;
    
    // Try to parse the current expression as a number
    const num = parseFloat(currentExpression);
    if (!isNaN(num)) {
        currentExpression = (-num).toString();
        updateDisplay();
    }
}

// Convert degrees to radians
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

// Convert radians to degrees
function toDegrees(radians) {
    return radians * (180 / Math.PI);
}

// Factorial function
function factorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

// Parse and evaluate expression
function evaluateExpression(expr) {
    try {
        // Replace mathematical symbols with JavaScript equivalents
        let processedExpr = expr
            .replace(/π/g, Math.PI)
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/−/g, '-')
            .replace(/E([+-]?\d+)/g, '*Math.pow(10,$1)'); // Handle scientific notation

        // Handle power operations (x^y, x^2, x^3)
        processedExpr = processedExpr.replace(/(\d+\.?\d*)\^2/g, 'Math.pow($1,2)');
        processedExpr = processedExpr.replace(/(\d+\.?\d*)\^3/g, 'Math.pow($1,3)');
        processedExpr = processedExpr.replace(/(\d+\.?\d*)\^([\d.]+)/g, 'Math.pow($1,$2)');

        // Handle factorial
        processedExpr = processedExpr.replace(/(\d+)!/g, (match, num) => {
            return factorial(parseInt(num));
        });

        // Handle percentage
        processedExpr = processedExpr.replace(/(\d+\.?\d*)%/g, '($1/100)');

        // Handle trigonometric functions
        const trigFunctions = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan'];
        trigFunctions.forEach(func => {
            const regex = new RegExp(func + '\\(([^)]+)\\)', 'g');
            processedExpr = processedExpr.replace(regex, (match, arg) => {
                const value = parseFloat(eval(arg));
                let result;
                
                if (func.startsWith('a')) {
                    // Inverse trig functions
                    const mathFunc = func === 'asin' ? Math.asin : 
                                    func === 'acos' ? Math.acos : Math.atan;
                    result = mathFunc(value);
                    if (angleMode === 'DEG') {
                        result = toDegrees(result);
                    }
                } else {
                    // Regular trig functions
                    const mathFunc = func === 'sin' ? Math.sin : 
                                    func === 'cos' ? Math.cos : Math.tan;
                    const inputValue = angleMode === 'DEG' ? toRadians(value) : value;
                    result = mathFunc(inputValue);
                }
                return result;
            });
        });

        // Handle logarithmic functions
        processedExpr = processedExpr.replace(/log\(([^)]+)\)/g, (match, arg) => {
            return Math.log10(eval(arg));
        });
        processedExpr = processedExpr.replace(/ln\(([^)]+)\)/g, (match, arg) => {
            return Math.log(eval(arg));
        });

        // Handle exponential function (e^x)
        processedExpr = processedExpr.replace(/exp\(([^)]+)\)/g, (match, arg) => {
            return Math.exp(eval(arg));
        });

        // Handle square root
        processedExpr = processedExpr.replace(/sqrt\(([^)]+)\)/g, (match, arg) => {
            return Math.sqrt(eval(arg));
        });

        // Handle cube root
        processedExpr = processedExpr.replace(/cbrt\(([^)]+)\)/g, (match, arg) => {
            return Math.cbrt(eval(arg));
        });

        // Handle absolute value
        processedExpr = processedExpr.replace(/abs\(([^)]+)\)/g, (match, arg) => {
            return Math.abs(eval(arg));
        });

        // Evaluate the final expression
        const result = eval(processedExpr);
        
        if (isNaN(result)) {
            return 'Math Error';
        }
        if (!isFinite(result)) {
            return 'Infinity';
        }
        
        // Round to reasonable precision
        return Number.isInteger(result) ? result : parseFloat(result.toFixed(10));
    } catch (error) {
        return 'Syntax Error';
    }
}

// Calculate and display result
function calculateResult() {
    if (!currentExpression) {
        updateResult('');
        return;
    }

    const result = evaluateExpression(currentExpression);
    
    if (typeof result === 'string') {
        showError(result);
    } else {
        updateResult(result);
    }
}

// Execute calculation (equals button)
function executeCalculation() {
    if (!currentExpression) return;
    
    const result = evaluateExpression(currentExpression);
    
    if (typeof result === 'string') {
        showError(result);
        setTimeout(() => {
            updateResult('');
        }, 2000);
    } else {
        lastResult = result;
        currentExpression = result.toString();
        updateDisplay();
        updateResult('');
    }
}

// Keyboard Support
function handleKeyboard(event) {
    // Only handle keyboard in calculator modes
    if (currentMode === 'notes') return;
    
    const key = event.key;
    
    // Numbers and basic operators
    if (/[0-9+\-*/.()%]/.test(key)) {
        event.preventDefault();
        handleInput(key);
    }
    // Enter key for equals
    else if (key === 'Enter' || key === '=') {
        event.preventDefault();
        executeCalculation();
    }
    // Backspace for delete
    else if (key === 'Backspace') {
        event.preventDefault();
        deleteLast();
    }
    // Escape for clear
    else if (key === 'Escape') {
        event.preventDefault();
        clearAll();
    }
}

// Canvas Drawing Functions
function initializeCanvas() {
    if (canvas) return; // Already initialized
    
    canvas = document.getElementById('drawingCanvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Drawing event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tool = this.getAttribute('data-tool');
            const action = this.getAttribute('data-action');
            
            if (tool) {
                currentTool = tool;
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            } else if (action === 'clear-canvas') {
                clearCanvas();
            }
        });
    });
    
    // Color buttons
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            currentColor = this.getAttribute('data-color');
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Stroke width slider
    const strokeSlider = document.getElementById('strokeWidth');
    const strokeValue = document.getElementById('strokeValue');
    
    strokeSlider.addEventListener('input', function() {
        currentStrokeWidth = this.value;
        strokeValue.textContent = this.value;
    });
    
    // Set initial background
    redrawCanvas();
}

function resizeCanvas() {
    if (!canvas) return;
    
    const rect = canvas.parentElement.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * scale;
    canvas.height = 400 * scale;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '400px';
    
    ctx.scale(scale, scale);
    redrawCanvas();
}

function redrawCanvas() {
    if (!ctx) return;
    
    const bgColor = currentTheme === 'dark' ? 'rgba(40, 40, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function startDrawing(e) {
    isDrawing = true;
    const pos = getMousePos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
    if (!isDrawing) return;
    
    const pos = getMousePos(e);
    
    ctx.lineWidth = currentStrokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (currentTool === 'pen') {
        ctx.strokeStyle = currentColor;
        ctx.globalCompositeOperation = 'source-over';
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = currentStrokeWidth * 3;
    }
    
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function clearCanvas() {
    if (!ctx) return;
    redrawCanvas();
}

// Event Listeners
themeToggleBtn.addEventListener('click', toggleTheme);
modeSwitchBtn.addEventListener('click', switchMode);

// Delegate button clicks for calculator modes
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn') || e.target.closest('.btn')) {
        const btn = e.target.classList.contains('btn') ? e.target : e.target.closest('.btn');
        
        const value = btn.getAttribute('data-value');
        const action = btn.getAttribute('data-action');
        
        if (value) {
            handleInput(value);
        } else if (action) {
            handleAction(action);
        }
    }
    
    // Angle mode toggle
    if (e.target.id === 'angleMode' || e.target.closest('#angleMode')) {
        toggleAngleMode();
    }
});

document.addEventListener('keydown', handleKeyboard);

// Initialize
initializeTheme();
updateDisplay();