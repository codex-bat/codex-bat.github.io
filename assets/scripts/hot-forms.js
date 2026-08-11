(function() {
    // ── label pairs for 1960s–70s newspaper style ──
    const variants = [
        { home: 'Front',       about: 'The Author' },
        { home: 'News',        about: 'Biography' },
        { home: 'Gazette',     about: 'Editors' },
        { home: 'Chronicle',   about: 'Profile' },
        { home: 'The Desk',    about: 'Our Correspondent' },
        { home: 'Front',        about: 'Masthead' },
        { home: 'Front Page',  about: 'About the Writer' }
    ];

    // pick one pair at random
    const pair = variants[Math.floor(Math.random() * variants.length)];

    // find the nav container (assumes exactly two <a> children)
    const nav = document.querySelector('nav');
    if (nav) {
        const links = nav.querySelectorAll('a');
        if (links.length >= 2) {
            // update the first link (home) and second link (about)
            links[0].textContent = pair.home;
            links[1].textContent = pair.about;
        }
    }
})();