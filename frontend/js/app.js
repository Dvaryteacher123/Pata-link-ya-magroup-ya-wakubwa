// ==========================================
// MAIN APPLICATION JAVASCRIPT
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Pata Link WhatsApp Groups - App Loaded');

    // ==========================================
    // LOADING SCREEN
    // ==========================================

    const loadingScreen = document.getElementById('loadingScreen');
    
    setTimeout(() => {
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }, 1500);

    // ==========================================
    // GET STARTED PAGE
    // ==========================================

    const getStartedPage = document.getElementById('getStartedPage');
    const homePage = document.getElementById('homePage');
    const getStartedBtn = document.getElementById('getStartedBtn');

    const hasSeenGetStarted = localStorage.getItem('hasSeenGetStarted');

    if (hasSeenGetStarted) {
        if (getStartedPage) getStartedPage.style.display = 'none';
        if (homePage) homePage.style.display = 'block';
        initializeHomePage();
    } else {
        if (getStartedPage) getStartedPage.style.display = 'flex';
        if (homePage) homePage.style.display = 'none';
    }

    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', function() {
            localStorage.setItem('hasSeenGetStarted', 'true');
            if (getStartedPage) getStartedPage.style.display = 'none';
            if (homePage) {
                homePage.style.display = 'block';
                initializeHomePage();
            }
        });
    }

    // ==========================================
    // NAVIGATION
    // ==========================================

    const navbar = document.getElementById('mainNav');
    const menuToggle = document.getElementById('navMenuToggle');
    const navLinks = document.getElementById('navLinks');

    window.addEventListener('scroll', function() {
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    });

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', function() {
            navLinks.classList.toggle('open');
        });
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function() {
            if (navLinks) navLinks.classList.remove('open');
        });
    });

    // ==========================================
    // SCROLL TO TOP BUTTON
    // ==========================================

    const scrollToTopBtn = document.getElementById('scrollToTopBtn');

    if (scrollToTopBtn) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 500) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        scrollToTopBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ==========================================
    // SEARCH FUNCTIONALITY
    // ==========================================

    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    function performSearch() {
        if (searchInput) {
            const query = searchInput.value.trim();
            if (query.length > 0) {
                filterGroups(query);
            }
        }
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }

    // ==========================================
    // FILTER BUTTONS
    // ==========================================

    const filterBtns = document.querySelectorAll('.filter-btn');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.getAttribute('data-filter');
            filterGroups(null, filter);
        });
    });

    // ==========================================
    // FILTER GROUPS FUNCTION
    // ==========================================

    function filterGroups(searchQuery = null, filter = 'all') {
        const groupCards = document.querySelectorAll('.group-card');
        
        groupCards.forEach(card => {
            let show = true;
            
            if (filter !== 'all') {
                const badge = card.querySelector('.group-card-badge');
                if (badge) {
                    const badgeText = badge.textContent.toLowerCase();
                    if (!badgeText.includes(filter)) {
                        show = false;
                    }
                }
            }
            
            if (searchQuery && show) {
                const title = card.querySelector('.group-card-title');
                const desc = card.querySelector('.group-card-description');
                const query = searchQuery.toLowerCase();
                
                const titleMatch = title && title.textContent.toLowerCase().includes(query);
                const descMatch = desc && desc.textContent.toLowerCase().includes(query);
                
                if (!titleMatch && !descMatch) {
                    show = false;
                }
            }
            
            card.style.display = show ? 'block' : 'none';
        });
    }

    window.filterGroups = filterGroups;

    // ==========================================
    // FAQ ACCORDION
    // ==========================================

    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        if (question) {
            question.addEventListener('click', function() {
                const isActive = item.classList.contains('active');
                faqItems.forEach(i => i.classList.remove('active'));
                if (!isActive) {
                    item.classList.add('active');
                }
            });
        }
    });

    // ==========================================
    // CONTACT FORM
    // ==========================================

    const contactForm = document.getElementById('contactForm');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for your message! We will get back to you soon.');
            this.reset();
        });
    }

    // ==========================================
    // NEWSLETTER FORM
    // ==========================================

    const newsletterForm = document.getElementById('newsletterForm');

    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const input = this.querySelector('input[type="email"]');
            if (input) {
                alert('Thank you for subscribing to our newsletter!');
                input.value = '';
            }
        });
    }

    // ==========================================
    // CHECK AUTHENTICATION STATUS
    // ==========================================

    function checkAuthStatus() {
        const token = localStorage.getItem('authToken');
        const loginBtn = document.getElementById('navLoginBtn');
        const signupBtn = document.getElementById('navSignupBtn');
        
        if (token) {
            const userData = localStorage.getItem('userData');
            let userName = 'Dashboard';
            try {
                if (userData) {
                    const user = JSON.parse(userData);
                    userName = user.fullName || user.displayName || 'Dashboard';
                }
            } catch {}
            
            if (loginBtn) {
                loginBtn.innerHTML = `<i class="fas fa-user"></i> ${userName}`;
                loginBtn.onclick = function() {
                    const user = userData ? JSON.parse(userData) : null;
                    if (user && user.email === 'dullamanyama0@gmail.com' && user.isAdmin) {
                        window.location.href = 'admin-dashboard.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                };
            }
            if (signupBtn) {
                signupBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
                signupBtn.onclick = function() {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userData');
                    localStorage.removeItem('rememberMe');
                    window.location.reload();
                };
            }
        } else {
            if (loginBtn) {
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
                loginBtn.onclick = function() {
                    window.location.href = 'login.html';
                };
            }
            if (signupBtn) {
                signupBtn.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
                signupBtn.onclick = function() {
                    window.location.href = 'signup.html';
                };
            }
        }
    }

    checkAuthStatus();

    // ==========================================
    // SUPPORT BUTTON - GLOBAL
    // ==========================================

    const supportEmail = 'dullamanyama0@gmail.com';
    
    if (!document.querySelector('.support-btn')) {
        const supportBtn = document.createElement('a');
        supportBtn.className = 'support-btn';
        supportBtn.href = `mailto:${supportEmail}`;
        supportBtn.innerHTML = `<i class="fas fa-headset"></i><span>Support</span>`;
        document.body.appendChild(supportBtn);
    }

    // ==========================================
    // ANIMATE STATISTICS NUMBERS
    // ==========================================

    function animateNumbers() {
        const numberElements = document.querySelectorAll('[data-count]');
        
        numberElements.forEach(element => {
            const target = parseInt(element.getAttribute('data-count'));
            if (target === 0) {
                element.textContent = '0';
                return;
            }
            
            const duration = 2000;
            const startTime = Date.now();
            
            function updateNumber() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const current = Math.floor(progress * target);
                element.textContent = current.toLocaleString();
                if (progress < 1) {
                    requestAnimationFrame(updateNumber);
                } else {
                    element.textContent = target.toLocaleString();
                }
            }
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        updateNumber();
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });
            
            observer.observe(element);
        });
    }

    // ==========================================
    // LOAD CATEGORIES FROM FIREBASE
    // ==========================================

    async function loadCategories() {
        const categoriesGrid = document.getElementById('categoriesGrid');
        if (!categoriesGrid) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/categories`);
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
                categoriesGrid.innerHTML = data.data.map(cat => `
                    <div class="category-card" data-category="${cat.name}">
                        <div class="category-card-icon"><i class="fas fa-tag"></i></div>
                        <div class="category-card-title">${cat.name}</div>
                        <div class="category-card-count">0 groups</div>
                    </div>
                `).join('');
            } else {
                categoriesGrid.innerHTML = `
                    <div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px;">
                        Hakuna categories kwa sasa.
                    </div>
                `;
            }
            
            document.querySelectorAll('.category-card').forEach(card => {
                card.addEventListener('click', function() {
                    const category = this.getAttribute('data-category');
                    filterGroups(category, 'all');
                    const groupsSection = document.getElementById('groupsSection');
                    if (groupsSection) {
                        groupsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });
        } catch (error) {
            console.error('Error loading categories:', error);
            categoriesGrid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px;">
                    Hakuna categories kwa sasa.
                </div>
            `;
        }
    }

    // ==========================================
    // LOAD GROUPS FROM FIREBASE
    // ==========================================

    async function loadGroups() {
        const groupsGrid = document.getElementById('groupsGrid');
        if (!groupsGrid) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/products`);
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
                groupsGrid.innerHTML = data.data.map(group => `
                    <div class="group-card" data-id="${group.id}" data-free="${group.isFree}" data-premium="${group.isPremium}" data-featured="${group.isFeatured}" data-trending="${group.isTrending}">
                        <div class="group-card-image">
                            ${group.imageUrl ? `<img src="${group.imageUrl}" alt="${group.title}">` : '<i class="fas fa-users"></i>'}
                            ${group.isFree ? '<span class="group-card-badge badge-free">FREE</span>' : ''}
                            ${group.isPremium ? '<span class="group-card-badge badge-premium">PREMIUM</span>' : ''}
                            ${group.isFeatured ? '<span class="group-card-badge badge-featured" style="top:50px;">FEATURED</span>' : ''}
                            ${group.isTrending ? '<span class="group-card-badge badge-trending" style="top:50px;right:auto;left:12px;">TRENDING</span>' : ''}
                        </div>
                        <div class="group-card-body">
                            <h3 class="group-card-title">${group.title}</h3>
                            <p class="group-card-description">${group.description || ''}</p>
                        </div>
                        <div class="group-card-footer">
                            <span class="group-card-price ${group.isFree ? 'free' : ''}">
                                ${group.isFree ? 'FREE' : `TSh ${(group.price || 0).toLocaleString()}`}
                            </span>
                            <button class="group-card-btn ${group.isFree ? 'free-btn' : ''}" data-id="${group.id}" data-free="${group.isFree}">
                                ${group.isFree ? 'Join Now' : 'View Details'}
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                groupsGrid.innerHTML = `
                    <div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px;">
                        Hakuna groups kwa sasa.
                    </div>
                `;
            }
            
            document.querySelectorAll('.group-card-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const groupId = this.getAttribute('data-id');
                    const isFree = this.getAttribute('data-free') === 'true';
                    
                    if (isFree) {
                        fetch(`${API_BASE_URL}/products/${groupId}`)
                            .then(res => res.json())
                            .then(data => {
                                if (data.success && data.data.whatsappLink) {
                                    window.open(data.data.whatsappLink, '_blank');
                                } else {
                                    alert('WhatsApp link not available');
                                }
                            })
                            .catch(err => console.error('Error:', err));
                    } else {
                        window.location.href = `payment.html?product=${groupId}`;
                    }
                });
            });
        } catch (error) {
            console.error('Error loading groups:', error);
            groupsGrid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px;">
                    Hakuna groups kwa sasa.
                </div>
            `;
        }
    }

    // ==========================================
    // LOAD TESTIMONIALS
    // ==========================================

    async function loadTestimonials() {
        const testimonialsGrid = document.getElementById('testimonialsGrid');
        if (!testimonialsGrid) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/testimonials`);
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
                const colors = ['#4F46E5', '#7C3AED', '#10B981', '#F59E0B', '#EF4444'];
                testimonialsGrid.innerHTML = data.data.map((t, index) => `
                    <div class="testimonial-card">
                        <p class="testimonial-text">"${t.message}"</p>
                        <div class="testimonial-author">
                            <div class="testimonial-avatar" style="background:${colors[index % colors.length]}">
                                ${t.name.charAt(0)}
                            </div>
                            <div>
                                <div class="testimonial-name">${t.name}</div>
                                <div class="testimonial-role">${t.role || ''}</div>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                testimonialsGrid.innerHTML = `
                    <div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px;">
                        Hakuna testimonials kwa sasa.
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading testimonials:', error);
        }
    }

    // ==========================================
    // LOAD FAQ
    // ==========================================

    async function loadFAQ() {
        const faqContainer = document.getElementById('faqContainer');
        if (!faqContainer) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/faq`);
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
                faqContainer.innerHTML = data.data.map((faq, index) => `
                    <div class="faq-item ${index === 0 ? 'active' : ''}">
                        <div class="faq-question">
                            <span>${faq.question}</span>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                        <div class="faq-answer">
                            <p>${faq.answer}</p>
                        </div>
                    </div>
                `).join('');
                
                document.querySelectorAll('.faq-item').forEach(item => {
                    const question = item.querySelector('.faq-question');
                    if (question) {
                        question.addEventListener('click', function() {
                            const isActive = item.classList.contains('active');
                            document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
                            if (!isActive) item.classList.add('active');
                        });
                    }
                });
            } else {
                faqContainer.innerHTML = `
                    <div style="text-align:center;color:var(--text-secondary);padding:40px;">
                        Hakuna FAQ kwa sasa.
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading FAQ:', error);
        }
    }

    // ==========================================
    // INITIALIZE HOME PAGE
    // ==========================================

    function initializeHomePage() {
        console.log('🏠 Home page initialized');
        loadCategories();
        loadGroups();
        loadTestimonials();
        loadFAQ();
        animateNumbers();
        checkAuthStatus();
    }

    // ==========================================
    // KEYBOARD SHORTCUTS
    // ==========================================

    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === '/') {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.focus();
        }
        
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });

    console.log('✅ App initialized successfully');
});
