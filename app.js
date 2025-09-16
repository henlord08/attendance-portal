document.addEventListener('DOMContentLoaded', () => {
    const searchBox = document.getElementById('searchBox');
    const suggestionsDiv = document.getElementById('suggestions');
    const staffIdField = document.getElementById('staffIdField');
    const staffNameField = document.getElementById('staffNameField');
    const submitBtn = document.getElementById('submitBtn');
    const exportBtn = document.getElementById('exportBtn');
    const statusDiv = document.getElementById('status');
    const spinner = submitBtn.querySelector('.spinner-border');

    let staffList = [];
    let selectedStaff = null;

    const showStatus = (message, type = 'success') => {
        const alertClass = `alert alert-${type}`;
        statusDiv.innerHTML = `<div class="${alertClass}" role="alert">${message}</div>`;
    };

    fetch('/api/staff')
        .then(response => response.json())
        .then(data => { staffList = data; })
        .catch(error => console.error('Error fetching staff list:', error));

    const selectStaff = (staff) => {
        selectedStaff = staff;
        searchBox.value = staff.staff_name;
        staffIdField.value = staff.staff_id;
        staffNameField.value = staff.staff_name;
        submitBtn.disabled = false;
        suggestionsDiv.innerHTML = '';
        statusDiv.innerHTML = '';
    };

    searchBox.addEventListener('input', () => {
        const query = searchBox.value.toLowerCase().trim();
        suggestionsDiv.innerHTML = '';
        
        if (!query) {
            selectedStaff = null;
            staffIdField.value = '';
            staffNameField.value = '';
            submitBtn.disabled = true;
            return;
        }
        const filteredStaff = staffList.filter(staff =>
            staff.staff_id.includes(query) ||
            staff.staff_name.toLowerCase().includes(query)
        ).slice(0, 5);
        filteredStaff.forEach(staff => {
            const suggestionItem = document.createElement('a');
            suggestionItem.href = '#';
            suggestionItem.className = 'list-group-item list-group-item-action';
            suggestionItem.innerHTML = `${staff.staff_name} <small class="text-muted">(${staff.staff_id})</small>`;
            suggestionItem.addEventListener('click', (e) => {
                e.preventDefault();
                selectStaff(staff);
            });
            suggestionsDiv.appendChild(suggestionItem);
        });
    });

    document.addEventListener('click', (e) => {
        const container = document.getElementById('suggestions-container');
        if (container && !container.contains(e.target)) {
            suggestionsDiv.innerHTML = '';
        }
    });
    
    // --- SIMPLIFIED: This now makes only one API call ---
    submitBtn.addEventListener('click', async () => {
        if (!selectedStaff) return;

        spinner.style.display = 'inline-block';
        submitBtn.disabled = true;
        statusDiv.innerHTML = ''; // Clear previous status

        try {
            const response = await fetch('/api/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedStaff)
            });

            const data = await response.json();

            if (response.ok) { // Status 200-299
                showStatus(data.message, 'success');
                searchBox.value = '';
                staffIdField.value = '';
                staffNameField.value = '';
                submitBtn.disabled = true;
            } else if (response.status === 409) { // Status 409 (Conflict/Duplicate)
                alert(data.message); // Show the duplicate message from the server in a pop-up
            } else {
                throw new Error(data.message || 'Already done submitted attendance.');
            }

        } catch (error) {
            showStatus(error.message, 'danger');
            console.error(error);
        } finally {
            spinner.style.display = 'none';
            // Re-enable button if a staff member is still selected (in case of error)
            if (selectedStaff && searchBox.value) {
                submitBtn.disabled = false;
            }
        }
    });
    
    exportBtn.addEventListener('click', () => {
        window.location.href = '/api/export';
    });
});