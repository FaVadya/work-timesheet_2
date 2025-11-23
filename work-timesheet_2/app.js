// app.js
class WorkTimesheet {
    constructor() {
        this.projects = [];
        this.entries = [];
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.isOnline = navigator.onLine;
        this.saveTimeout = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderCalendar();
        this.updateStats();
        this.setupNetworkListeners();
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncData();
            this.showMessage('Соединение восстановлено', 'success');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showMessage('Работа в офлайн-режиме', 'warning');
        });
    }

    // Гибридное сохранение данных
    saveData() {
        const data = {
            projects: this.projects,
            entries: this.entries,
            lastSaved: new Date().toISOString()
        };

        // Немедленное сохранение в localStorage (синхронно)
        this.saveToLocalStorage(data);
        
        // Отложенное сохранение для избежания блокировки UI
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.deferredSave(data);
        }, 500);
    }

    saveToLocalStorage(data) {
        try {
            localStorage.setItem('workTimesheet_data', JSON.stringify(data));
            localStorage.setItem('workTimesheet_backup', JSON.stringify(data));
        } catch (e) {
            console.error('Ошибка сохранения в localStorage:', e);
            this.cleanupStorage();
        }
    }

    deferredSave(data) {
        // Дополнительные операции сохранения если нужно
        this.updateLastSavedTime();
    }

    cleanupStorage() {
        // Очистка старых данных при нехватке места
        const keys = Object.keys(localStorage).filter(key => 
            key.startsWith('workTimesheet_'));
        
        if (keys.length > 10) {
            // Удаляем самые старые данные
            keys.sort().slice(0, 5).forEach(key => {
                localStorage.removeItem(key);
            });
        }
    }

    loadData() {
        // Приоритетная загрузка: localStorage -> backup -> начальные данные
        let data = null;
        
        try {
            const mainData = localStorage.getItem('workTimesheet_data');
            if (mainData) {
                data = JSON.parse(mainData);
            } else {
                const backupData = localStorage.getItem('workTimesheet_backup');
                if (backupData) {
                    data = JSON.parse(backupData);
                    // Восстанавливаем основную копию из бэкапа
                    localStorage.setItem('workTimesheet_data', backupData);
                }
            }
        } catch (e) {
            console.error('Ошибка загрузки данных:', e);
            this.loadFromBackup();
            return;
        }

        if (data) {
            this.projects = data.projects || [];
            this.entries = data.entries || [];
            
            // Миграция старых данных если нужно
            this.migrateOldData();
        } else {
            this.loadInitialData();
        }
    }

    loadFromBackup() {
        try {
            const backup = localStorage.getItem('workTimesheet_backup');
            if (backup) {
                const data = JSON.parse(backup);
                this.projects = data.projects || [];
                this.entries = data.entries || [];
            } else {
                this.loadInitialData();
            }
        } catch (e) {
            this.loadInitialData();
        }
    }

    loadInitialData() {
        this.projects = [
            { id: 1, name: 'Разработка', color: '#3b82f6' },
            { id: 2, name: 'Тестирование', color: '#ef4444' },
            { id: 3, name: 'Дизайн', color: '#10b981' },
            { id: 4, name: 'Встречи', color: '#f59e0b' }
        ];
        this.entries = [];
    }

    migrateOldData() {
        // Миграция данных из старого формата если нужно
        this.entries = this.entries.map(entry => {
            if (!entry.id) {
                entry.id = this.generateId();
            }
            return entry;
        });
    }

    // Надежное добавление записи
    addEntry(date, projectId, hours) {
        const entryId = this.generateId();
        const newEntry = {
            id: entryId,
            date: date,
            projectId: parseInt(projectId),
            hours: parseFloat(hours),
            createdAt: new Date().toISOString(),
            synced: this.isOnline
        };

        // Немедленное добавление в UI
        this.entries.push(newEntry);
        this.renderCalendar();
        this.updateStats();

        // Сохранение с повторными попытками
        this.saveWithRetry();
        
        return entryId;
    }

    saveWithRetry() {
        this.retryCount = 0;
        this.attemptSave();
    }

    attemptSave() {
        try {
            this.saveData();
            this.retryCount = 0;
        } catch (e) {
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                setTimeout(() => this.attemptSave(), 1000 * this.retryCount);
            } else {
                console.error('Не удалось сохранить после нескольких попыток:', e);
                this.showMessage('Ошибка сохранения данных', 'error');
            }
        }
    }

    syncData() {
        if (this.isOnline) {
            // Здесь можно добавить синхронизацию с сервером
            console.log('Синхронизация данных...');
        }
    }

    updateLastSavedTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU');
        const savedElement = document.getElementById('lastSaved');
        if (savedElement) {
            savedElement.textContent = `Сохранено: ${timeString}`;
        }
    }

    showMessage(text, type = 'info') {
        // Простая система уведомлений
        console.log(`${type.toUpperCase()}: ${text}`);
        
        // Можно добавить визуальные уведомления
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = text;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
            color: white;
            border-radius: 5px;
            z-index: 1000;
        `;
        
        document.body.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), 3000);
    }

    // Остальные методы остаются без изменений
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    setupEventListeners() {
        // Существующие обработчики событий
        document.getElementById('prevMonth').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.changeMonth(1));
        document.getElementById('projectForm').addEventListener('submit', (e) => this.addProject(e));
        document.getElementById('statsPeriod').addEventListener('change', () => this.updateStats());
        
        // Новая кнопка принудительного сохранения
        const saveButton = document.getElementById('forceSave');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.saveWithRetry();
                this.showMessage('Принудительное сохранение...', 'info');
            });
        }
    }

    renderCalendar() {
        // Существующая логика рендеринга календаря
        const calendarDiv = document.getElementById('calendar');
        const monthYearDiv = document.getElementById('monthYear');
        
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        
        monthYearDiv.textContent = firstDay.toLocaleDateString('ru-RU', { 
            month: 'long', 
            year: 'numeric' 
        });

        let calendarHTML = '';
        
        // Дни недели
        calendarHTML += '<div class="weekdays">';
        ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(day => {
            calendarHTML += `<div class="weekday">${day}</div>`;
        });
        calendarHTML += '</div>';

        // Ячейки календаря
        calendarHTML += '<div class="days">';
        
        // Пустые ячейки для первого дня
        for (let i = 0; i < (firstDay.getDay() + 6) % 7; i++) {
            calendarHTML += '<div class="day empty"></div>';
        }

        // Дни месяца
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(this.currentYear, this.currentMonth, day);
            const dateString = date.toISOString().split('T')[0];
            const dayEntries = this.entries.filter(entry => entry.date === dateString);
            
            calendarHTML += `<div class="day" data-date="${dateString}">`;
            calendarHTML += `<div class="day-number">${day}</div>`;
            
            if (dayEntries.length > 0) {
                dayEntries.forEach(entry => {
                    const project = this.projects.find(p => p.id === entry.projectId);
                    if (project) {
                        calendarHTML += `
                            <div class="entry" style="background-color: ${project.color}">
                                ${project.name}: ${entry.hours}ч
                            </div>
                        `;
                    }
                });
            }
            
            calendarHTML += `</div>`;
        }

        calendarHTML += '</div>';
        calendarDiv.innerHTML = calendarHTML;

        // Обработчики кликов по дням
        calendarDiv.querySelectorAll('.day[data-date]').forEach(dayElement => {
            dayElement.addEventListener('click', () => this.showDayModal(dayElement.dataset.date));
        });
    }

    showDayModal(date) {
        // Логика модального окна
        const modal = document.getElementById('dayModal');
        const dateElement = document.getElementById('modalDate');
        const entriesList = document.getElementById('modalEntries');
        
        dateElement.textContent = new Date(date).toLocaleDateString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const dayEntries = this.entries.filter(entry => entry.date === date);
        
        entriesList.innerHTML = '';
        dayEntries.forEach(entry => {
            const project = this.projects.find(p => p.id === entry.projectId);
            const entryElement = document.createElement('div');
            entryElement.className = 'entry-item';
            entryElement.innerHTML = `
                <span style="color: ${project.color}">${project.name}</span>
                <span>${entry.hours}ч</span>
                <button class="delete-entry" data-id="${entry.id}">×</button>
            `;
            entriesList.appendChild(entryElement);
        });

        // Обработчики удаления
        entriesList.querySelectorAll('.delete-entry').forEach(button => {
            button.addEventListener('click', (e) => {
                this.deleteEntry(e.target.dataset.id);
                this.showDayModal(date);
            });
        });

        // Форма добавления
        const form = document.getElementById('addEntryForm');
        form.onsubmit = (e) => {
            e.preventDefault();
            const projectId = document.getElementById('entryProject').value;
            const hours = document.getElementById('entryHours').value;
            
            if (projectId && hours) {
                this.addEntry(date, projectId, hours);
                this.showDayModal(date);
                form.reset();
            }
        };

        // Заполнение проектов
        const projectSelect = document.getElementById('entryProject');
        projectSelect.innerHTML = '';
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
        });

        modal.style.display = 'block';
    }

    deleteEntry(entryId) {
        this.entries = this.entries.filter(entry => entry.id !== entryId);
        this.saveWithRetry();
        this.renderCalendar();
        this.updateStats();
    }

    changeMonth(direction) {
        this.currentMonth += direction;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.renderCalendar();
    }

    addProject(e) {
        e.preventDefault();
        const nameInput = document.getElementById('projectName');
        const colorInput = document.getElementById('projectColor');
        
        const newProject = {
            id: this.generateId(),
            name: nameInput.value,
            color: colorInput.value
        };
        
        this.projects.push(newProject);
        this.saveWithRetry();
        this.renderCalendar();
        
        nameInput.value = '';
        colorInput.value = '#3b82f6';
    }

    updateStats() {
        const period = document.getElementById('statsPeriod').value;
        const now = new Date();
        let startDate;

        switch (period) {
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(0);
        }

        const filteredEntries = this.entries.filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate >= startDate;
        });

        const stats = {};
        filteredEntries.forEach(entry => {
            if (!stats[entry.projectId]) {
                stats[entry.projectId] = 0;
            }
            stats[entry.projectId] += entry.hours;
        });

        const statsDiv = document.getElementById('stats');
        statsDiv.innerHTML = '<h3>Статистика</h3>';

        Object.keys(stats).forEach(projectId => {
            const project = this.projects.find(p => p.id === parseInt(projectId));
            if (project) {
                const statElement = document.createElement('div');
                statElement.className = 'stat-item';
                statElement.innerHTML = `
                    <span class="stat-color" style="background-color: ${project.color}"></span>
                    <span class="stat-name">${project.name}</span>
                    <span class="stat-hours">${stats[projectId]}ч</span>
                `;
                statsDiv.appendChild(statElement);
            }
        });

        const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
        const totalElement = document.createElement('div');
        totalElement.className = 'stat-total';
        totalElement.textContent = `Всего: ${totalHours}ч`;
        statsDiv.appendChild(totalElement);
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.timesheetApp = new WorkTimesheet();
});

// Закрытие модального окна
document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('dayModal').style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('dayModal')) {
        document.getElementById('dayModal').style.display = 'none';
    }
});