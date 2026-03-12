```markdown
# Info Card

A sleek, cross-platform desktop application for creating and displaying customizable information cards. Built with Electron, Info Card provides a modern, responsive interface for presenting structured data in an elegant card-based layout.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-9fe2bf?style=flat&logo=electron&logoColor=black)

## Description

Info Card is a lightweight Electron application designed to display interactive information cards with a clean, modern UI. Whether you're showcasing contact information, product details, or personal profiles, this application provides a customizable template with support for custom icons, styling, and dynamic content rendering.

## Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v14.0.0 or higher)
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/info_card.git
cd info_card

# Install dependencies
npm install

# Generate application icon (optional)
node create-icon.js
```

### Build
```bash
# Run in development mode
npm start

# Build for production
npm run build
```

## Usage

1. **Launch the Application**
   ```bash
   npm start
   ```

2. **Customize Content**
   - Edit `index.html` to modify card structure
   - Update `style.css` to change visual appearance
   - Modify `renderer.js` to adjust interactive behavior

3. **Customize Icon**
   - Replace `icon.svg` with your custom SVG logo
   - Run `node create-icon.js` to regenerate application icons

4. **Configuration**
   - Adjust window settings in `main.js`
   - Modify preload scripts in `preload.js` for secure IPC communication

## Technologies

- **[Electron](https://www.electronjs.org/)** - Cross-platform desktop application framework
- **[Node.js](https://nodejs.org/)** - JavaScript runtime environment
- **HTML5 & CSS3** - Modern markup and styling
- **JavaScript (ES6+)** - Application logic and interactivity
- **SVG** - Scalable vector graphics for crisp icons

### Project Structure
```
info_card/
├── main.js           # Main process entry point
├── preload.js        # Preload script for secure context bridging
├── renderer.js       # Renderer process logic
├── index.html        # Application UI structure
├── style.css         # Styling and layout
├── icon.svg          # Application icon source
├── create-icon.js    # Icon generation utility
├── package.json      # Project dependencies and metadata
└── .gitignore        # Git ignore rules
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Note**: This application uses context isolation and secure preload scripts to ensure safe IPC communication between the main and renderer processes.
```