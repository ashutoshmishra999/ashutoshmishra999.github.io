// Money Coach App - Main JavaScript

// ==================== DATA MANAGEMENT ====================

// Initialize or load data from localStorage
function loadData() {
    const data = {
        apiKey: localStorage.getItem('moneyCoach_apiKey') || '',
        monthlyBudget: parseInt(localStorage.getItem('moneyCoach_budget')) || 0,
        expenses: JSON.parse(localStorage.getItem('moneyCoach_expenses')) || []
    };
    return data;
}

function saveData(data) {
    if (data.apiKey !== undefined) {
        localStorage.setItem('moneyCoach_apiKey', data.apiKey);
    }
    if (data.monthlyBudget !== undefined) {
        localStorage.setItem('moneyCoach_budget', data.monthlyBudget);
    }
    if (data.expenses !== undefined) {
        localStorage.setItem('moneyCoach_expenses', JSON.stringify(data.expenses));
    }
}

// ==================== INITIALIZATION ====================

window.addEventListener('DOMContentLoaded', () => {
    const data = loadData();

    // Check if user has completed setup
    if (data.apiKey && data.monthlyBudget > 0) {
        showMainApp();
        updateDashboard();
    } else {
        showSetup();
    }
});

function showSetup() {
    document.getElementById('setupSection').style.display = 'block';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    const data = loadData();
    document.getElementById('setupSection').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('budgetDisplay').textContent = data.monthlyBudget.toLocaleString('en-IN');
}

// ==================== SETUP FUNCTIONS ====================

function saveSetup() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const budget = parseInt(document.getElementById('monthlyBudgetInput').value);

    if (!apiKey || !apiKey.startsWith('sk-')) {
        alert('Please enter a valid OpenAI API key (starts with sk-)');
        return;
    }

    if (!budget || budget <= 0) {
        alert('Please enter a valid monthly budget');
        return;
    }

    saveData({ apiKey, monthlyBudget: budget });
    showMainApp();
    updateDashboard();
}

// ==================== SETTINGS FUNCTIONS ====================

function showSettings() {
    const data = loadData();
    document.getElementById('settingsApiKey').value = data.apiKey;
    document.getElementById('settingsBudget').value = data.monthlyBudget;
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function updateSettings() {
    const apiKey = document.getElementById('settingsApiKey').value.trim();
    const budget = parseInt(document.getElementById('settingsBudget').value);

    if (!apiKey || !apiKey.startsWith('sk-')) {
        alert('Please enter a valid OpenAI API key');
        return;
    }

    if (!budget || budget <= 0) {
        alert('Please enter a valid monthly budget');
        return;
    }

    saveData({ apiKey, monthlyBudget: budget });
    document.getElementById('budgetDisplay').textContent = budget.toLocaleString('en-IN');
    closeSettings();
    updateDashboard();
}

function resetAllData() {
    if (confirm('Are you sure? This will delete all your data including expenses, budget, and API key.')) {
        localStorage.clear();
        location.reload();
    }
}

// ==================== EXPENSE LOGGING ====================

async function logExpense() {
    const description = document.getElementById('expenseDescription').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;

    if (!description) {
        alert('Please enter a description');
        return;
    }

    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    // Create expense object
    const expense = {
        id: Date.now(),
        description,
        amount,
        category,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-IN')
    };

    // Save to localStorage
    const data = loadData();
    data.expenses.unshift(expense); // Add to beginning
    saveData({ expenses: data.expenses });

    // Clear form
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseAmount').value = '';

    // Update UI
    updateDashboard();

    // Get AI coach response
    await getCoachResponse(expense, data);
}

// ==================== AI COACH INTEGRATION ====================

async function getCoachResponse(expense, data) {
    const coachCard = document.getElementById('coachResponse');
    const coachMessage = document.getElementById('coachMessage');

    // Show loading state
    coachCard.style.display = 'flex';
    coachMessage.innerHTML = '💭 Thinking...';

    try {
        // Analyze spending context
        const context = analyzeSpendingContext(expense, data);

        // Build prompt for OpenAI
        const prompt = buildCoachPrompt(expense, context, data.monthlyBudget);

        // Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are a warm, witty, and supportive money coach. Your job is to respond to expense entries with insight and humor. Keep responses short (max 2-3 sentences), conversational, and never judgmental. Combine practical financial reflection with empathy or encouragement. Use Indian Rupee (₹) for all amounts.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 150
            })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const result = await response.json();
        const coachReply = result.choices[0].message.content;

        // Display response
        coachMessage.innerHTML = coachReply;

    } catch (error) {
        console.error('Error getting coach response:', error);
        coachMessage.innerHTML = '❌ Oops! Couldn\'t reach your coach right now. Check your API key in settings or try again later.';
    }
}

function analyzeSpendingContext(expense, data) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    // Filter this week's expenses
    const thisWeekExpenses = data.expenses.filter(e => {
        const expenseDate = new Date(e.timestamp);
        return expenseDate >= weekStart;
    });

    // Count specific categories this week
    const categoryCount = thisWeekExpenses.filter(e => e.category === expense.category).length;
    const coffeeCount = thisWeekExpenses.filter(e => e.category === 'coffee').length;

    // Calculate totals
    const weekTotal = thisWeekExpenses.reduce((sum, e) => sum + e.amount, 0);
    const categoryTotal = thisWeekExpenses
        .filter(e => e.category === expense.category)
        .reduce((sum, e) => sum + e.amount, 0);

    // Monthly projection
    const monthlyProjection = (weekTotal / (now.getDay() || 7)) * 30;

    return {
        categoryCount,
        coffeeCount,
        weekTotal,
        categoryTotal,
        monthlyProjection,
        transactionCount: thisWeekExpenses.length
    };
}

function buildCoachPrompt(expense, context, monthlyBudget) {
    let prompt = `User entry: "${expense.description} ₹${expense.amount}"\n`;
    prompt += `Category: ${expense.category}\n`;
    prompt += `Monthly budget: ₹${monthlyBudget}\n`;
    prompt += `This week so far:\n`;
    prompt += `- Total spent: ₹${context.weekTotal}\n`;
    prompt += `- Number of ${expense.category} purchases: ${context.categoryCount}\n`;
    prompt += `- Total ${expense.category} spending: ₹${context.categoryTotal}\n`;

    if (expense.category === 'coffee' || context.coffeeCount > 0) {
        prompt += `- Coffee/drinks count this week: ${context.coffeeCount}\n`;
    }

    prompt += `- Monthly projection: ₹${Math.round(context.monthlyProjection)}\n\n`;
    prompt += `Respond with a witty, warm, and insightful message (2-3 sentences max).`;

    return prompt;
}

// ==================== DASHBOARD UPDATES ====================

function updateDashboard() {
    const data = loadData();

    // Update stats
    updateWeeklyStats(data);

    // Update expense history
    updateExpenseHistory(data);
}

function updateWeeklyStats(data) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // Filter this week's expenses
    const thisWeekExpenses = data.expenses.filter(e => {
        const expenseDate = new Date(e.timestamp);
        return expenseDate >= weekStart;
    });

    // Calculate stats
    const weekSpending = thisWeekExpenses.reduce((sum, e) => sum + e.amount, 0);
    const weekTransactions = thisWeekExpenses.length;
    const coffeeCount = thisWeekExpenses.filter(e => e.category === 'coffee').length;

    // Update UI
    document.getElementById('weekSpending').textContent = weekSpending.toLocaleString('en-IN');
    document.getElementById('weekTransactions').textContent = weekTransactions;
    document.getElementById('coffeeCount').textContent = coffeeCount;
}

function updateExpenseHistory(data) {
    const historyDiv = document.getElementById('expenseHistory');

    if (data.expenses.length === 0) {
        historyDiv.innerHTML = '<p class="empty-state">No expenses logged yet. Start tracking!</p>';
        return;
    }

    // Show latest 20 expenses
    const recentExpenses = data.expenses.slice(0, 20);

    historyDiv.innerHTML = recentExpenses.map(expense => {
        const categoryEmojis = {
            food: '🍔',
            coffee: '☕',
            shopping: '🛍️',
            transport: '🚗',
            entertainment: '🎬',
            bills: '💡',
            other: '📦'
        };

        const date = new Date(expense.timestamp);
        const timeAgo = getTimeAgo(date);

        return `
            <div class="expense-item">
                <div class="expense-details">
                    <div class="expense-desc">${categoryEmojis[expense.category]} ${expense.description}</div>
                    <div class="expense-meta">${timeAgo}</div>
                </div>
                <div class="expense-amount">₹${expense.amount.toLocaleString('en-IN')}</div>
            </div>
        `;
    }).join('');
}

// ==================== UTILITY FUNCTIONS ====================

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-IN');
}

// ==================== KEYBOARD SHORTCUTS ====================

document.addEventListener('keydown', (e) => {
    // Press Enter in expense fields to submit
    if (e.key === 'Enter') {
        const activeElement = document.activeElement;
        if (activeElement.id === 'expenseDescription' || activeElement.id === 'expenseAmount') {
            logExpense();
        }
    }

    // Press Escape to close modal
    if (e.key === 'Escape') {
        closeSettings();
    }
});

// Close modal when clicking outside
document.getElementById('settingsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') {
        closeSettings();
    }
});
