# Indexxorcist

![Indexxorcist Logo](src-tauri/icons/Square284x284Logo.png)

**A powerful, cross-platform desktop application for SQL Server index maintenance.**

---

## 🚀 Overview

**Indexxorcist** is a specialized tool built to analyze, reorganize, and rebuild fragmented indexes in SQL Server databases. Built with a modern **React** frontend and a blazingly fast **Rust (Tauri)** backend, it allows database administrators and developers to efficiently manage index fragmentation, track execution history, and optimize database performance.

## ✨ Key Features

- **Multi-Profile Management**: Save and manage connections securely using the native OS keychain for multiple SQL Server instances.
- **Granular Threshold Control**: Automatically determine whether to `REORGANIZE` or `REBUILD` an index based on user-defined fragmentation thresholds.
- **Parallel Processing**: Speed up maintenance tasks by processing multiple databases concurrently.
- **Real-Time Control**: Pause, resume, skip specific databases, or stop the entire maintenance run mid-execution without leaving the application in a bad state.
- **Historical Tracking**: A local SQLite database tracks the execution history, providing detailed summaries of processed databases, reorganized/rebuilt indexes, and durations.
- **Modern UI**: An intuitive, wizard-style dashed interface built with React, Tailwind CSS, and Zustand.

## 🛠️ Technology Stack

**Frontend:**

- [React 18](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://github.com/pmndrs/zustand) (State management)
- [Lucide React](https://lucide.dev/) (Icons)

**Backend:**

- [Tauri](https://tauri.app/) (Desktop application framework)
- [Rust](https://www.rust-lang.org/)
- [Tiberius](https://github.com/prisma/tiberius) (Native SQL Server driver)
- [Rusqlite](https://github.com/rusqlite/rusqlite) (SQLite for history)
- OS Keychain Integration for secure password storage.

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) & [Bun](https://bun.sh/) (or npm/yarn)
- [Rust](https://www.rust-lang.org/tools/install) (Ensure `rustc` and `cargo` are available)
- Tauri dependencies required for your local OS (e.g., Xcode Command Line Tools on macOS).

### Development

To run the application locally in development mode:

1. Install frontend dependencies:

   ```bash
   bun install
   ```

2. Start the development server and open the Tauri window:

   ```bash
   bun tauri dev
   ```

### Building for Production

To build the executable for your platform:

```bash
bun run build
bun tauri build
```

The compiled binaries will be located under `src-tauri/target/release/bundle/`.

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
