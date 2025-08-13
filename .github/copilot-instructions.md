# SEO-APP GitHub Copilot Instructions

SEO-APP is a comprehensive Node.js-based SEO analysis tool with an Express.js backend API and an interactive HTML/CSS/JavaScript frontend. The application analyzes keywords using multiple external APIs, generates visual reports, and provides a complete web interface for SEO analysis.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Initial Setup and Dependencies
- Ensure Node.js 18+ is installed (tested with Node.js v20.19.4)
- `npm install` - Install all dependencies - takes ~10 seconds, no known issues
- All dependencies are production-ready with no security vulnerabilities

### Starting the Application
- `npm start` - Start complete application (backend + frontend) - starts in <1 second
- `npm run server` - Start API server only (no startup messages) - starts in <1 second  
- `npm run dev` - Development mode with auto-reload - starts in <1 second
- `npm run server:dev` - API server in development mode with auto-reload - starts in <1 second

**NEVER CANCEL these startup commands - they complete in under 1 second.**

### Testing
- `npm run test` - Run test suite using Node.js built-in test runner - takes ~0.5 seconds
- **EXPECTED**: External API tests will fail in sandboxed environments due to network restrictions
- Core functionality tests (9/14) pass successfully
- Test failures for Google Suggestions, Keywordsur APIs, and missing sample data are NORMAL

**NEVER CANCEL test commands - they complete in under 1 second.**

## Application URLs and Endpoints

### Frontend Web Interface
- Main application: `http://localhost:3000/`
- Report details page: `http://localhost:3000/report-details.html`
- Analytics/charts page: `http://localhost:3000/analytics.html`

### API Endpoints
- Health check: `GET http://localhost:3000/api/health`
- List reports: `GET http://localhost:3000/api/seo/reports`
- Get specific report: `GET http://localhost:3000/api/seo/report/:filename`
- Create analysis: `POST http://localhost:3000/api/seo/analyze`
- Download file: `GET http://localhost:3000/api/seo/download/:filename`
- Delete report: `DELETE http://localhost:3000/api/seo/report/:filename`
- Analyze suggestions: `POST http://localhost:3000/api/seo/analyze-suggestions`

## Validation Scenarios

### Always test these scenarios after making changes:
1. **Application startup**: Run `npm start` and verify server starts without errors
2. **Health check**: Verify `curl http://localhost:3000/api/health` returns success status
3. **Frontend load**: Verify homepage loads at `http://localhost:3000/`
4. **Reports endpoint**: Verify `curl http://localhost:3000/api/seo/reports` returns valid JSON
5. **Theme switching**: Test light/dark theme toggle button on any page
6. **Navigation**: Test all page navigation buttons work correctly

### External API Limitations in Sandboxed Environments
- Google Suggestions API (`suggestqueries.google.com`) - **WILL FAIL** in sandboxed environments
- Keywordsur API (`db3.keywordsur.fr`, `db.keywordsur.fr`) - **WILL FAIL** in sandboxed environments
- This is EXPECTED behavior - the application gracefully handles API failures
- Focus testing on core functionality, UI, and local data processing

## Repository Structure

### Key Directories
```
SEO-APP/
├── src/
│   ├── api/              # External API integrations
│   │   ├── googleSuggestions.js
│   │   ├── keywordsur.js
│   │   └── urlAnalysis.js
│   ├── server/           # Express.js backend
│   │   ├── server.js     # Main server file
│   │   ├── app.js        # Express app configuration
│   │   └── routes/seo.js # API routes
│   ├── services/         # Business logic
│   │   ├── keywordService.js
│   │   └── exportService.js
│   └── utils/            # Utilities
│       ├── encoder.js
│       └── headers.js
├── public/               # Frontend web interface
│   ├── index.html        # Main page
│   ├── report-details.html # Report details view
│   ├── analytics.html    # Charts and analysis
│   ├── *.css            # Styling files
│   ├── *.js             # Frontend JavaScript
│   └── assets/          # Images, icons, manifests
├── data/results/        # Generated reports (JSON/CSV)
├── tests/               # Test suite
├── examples/            # Example usage scripts
└── debug-*.js          # Debug and development scripts
```

### Important Files to Check When Making Changes
- After modifying API contracts: Always check `src/server/routes/seo.js`
- After changing data structures: Always check `src/services/keywordService.js`
- After frontend changes: Always test all three HTML pages
- After styling changes: Always test both light and dark themes

## Development Best Practices

### Code Style and Quality
- **NO LINTING TOOLS CONFIGURED**: The project does not use ESLint, Prettier, or other linting tools
- Follow existing code patterns and ES6+ module syntax
- Use async/await consistently throughout the codebase
- Maintain error handling patterns used in existing API routes

### Data Handling
- All reports stored in `data/results/` directory
- JSON files for complete data, CSV files for summaries
- Filename pattern: `seo_report_full_YYYY-MM-DDTHH-mm-ss-sssZ.json`
- Always validate file existence before operations

### Frontend Development
- Uses vanilla JavaScript (no frameworks)
- Chart.js for data visualization
- Responsive design with CSS Grid/Flexbox
- Theme system with CSS variables for light/dark modes
- LocalStorage for user preferences

## Common Tasks and Workflows

### Adding New API Endpoints
1. Add route handler in `src/server/routes/seo.js`
2. Update API documentation in comments
3. Test with curl commands
4. Add corresponding frontend integration if needed

### Frontend Modifications
1. Always test in both light and dark themes
2. Verify responsive design on different screen sizes
3. Test all navigation between pages
4. Ensure proper error handling and loading states

### Testing External API Integration
- Use debug scripts in root directory (`debug-*.js`) for development
- External APIs will fail in sandboxed environments - this is expected
- Focus on data structure validation and error handling

## Troubleshooting Common Issues

### Port Already in Use
- Kill existing processes: `pkill -f "node.*3000" || true`
- Or use different port in development

### Missing Dependencies
- Run `npm install` if node_modules missing
- Check package.json for version requirements

### External API Failures
- Expected in sandboxed environments
- Check network connectivity if developing locally
- Verify API endpoints in respective files under `src/api/`

### Frontend Not Loading
- Verify server is running with `curl http://localhost:3000/api/health`
- Check browser console for specific errors
- Ensure all static files are properly served

## Performance Notes

- **Startup time**: <1 second for all modes
- **Installation time**: ~10 seconds for `npm install`
- **Test execution**: ~0.5 seconds
- **Memory usage**: Minimal - suitable for development environments
- **No build step required**: Application runs directly with Node.js

## Security and External Dependencies

### External Services Used
- Google Suggestions API (for keyword suggestions)
- Keywordsur API (for SEO metrics and domain analysis)
- Chart.js CDN (for data visualization)

### Data Privacy
- All analysis data stored locally in `data/results/`
- No data sent to external services except for API calls
- User preferences stored in browser LocalStorage only

## Common Tasks - Reference Output

The following are outputs from frequently run commands. Reference them instead of running bash commands to save time.

### Repository Root Structure
```
ls -la /home/runner/work/SEO-APP/SEO-APP
total 140
drwxr-xr-x 8 runner docker  4096 Aug 13 09:27 .
drwxr-xr-x 3 runner docker  4096 Aug 13 09:20 ..
drwxr-xr-x 8 runner docker  4096 Aug 13 09:20 .git
-rw-r--r-- 1 runner docker  1842 Aug 13 09:20 .gitignore
-rw-r--r-- 1 runner docker  2846 Aug 13 09:20 ANALYZE_SUGGESTIONS_FEATURE.md
-rw-r--r-- 1 runner docker  3750 Aug 13 09:20 API_DOCS.md
-rw-r--r-- 1 runner docker  8901 Aug 13 09:20 README.md
-rw-r--r-- 1 runner docker   426 Aug 13 09:20 arquitectura.md
drwxr-xr-x 3 runner docker  4096 Aug 13 09:20 data
-rw-r--r-- 1 runner docker  1557 Aug 13 09:20 debug-endpoint.js
-rw-r--r-- 1 runner docker   635 Aug 13 09:20 debug-keywords.js
-rw-r--r-- 1 runner docker   731 Aug 13 09:20 debug-patterns.js
-rw-r--r-- 1 runner docker   706 Aug 13 09:20 debug-specific.js
-rw-r--r-- 1 runner docker   728 Aug 13 09:20 debug-suggestions.js
drwxr-xr-x 2 runner docker  4096 Aug 13 09:20 examples
drwxr-xr-x   75 runner docker  4096 Aug 13 09:23 node_modules
-rw-r--r-- 1 runner docker 58673 Aug 13 09:20 package-lock.json
-rw-r--r-- 1 runner docker   661 Aug 13 09:20 package.json
drwxr-xr-x 2 runner docker  4096 Aug 13 09:20 public
drwxr-xr-x 4 runner docker  4096 Aug 13 09:20 src
drwxr-xr-x 2 runner docker  4096 Aug 13 09:20 tests
```

### Package.json Scripts
```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js", 
    "server": "node src/server/server.js",
    "server:dev": "node --watch src/server/server.js",
    "test": "node --test"
  }
}
```

### Health Check Response
```bash
curl http://localhost:3000/api/health
{"status":"OK","message":"SEO API Server running","timestamp":"2025-08-13T09:27:50.746Z"}
```

### Reports Endpoint Response  
```bash
curl http://localhost:3000/api/seo/reports
{"success":true,"count":0,"reports":[]}
```

### Test Suite Results Summary
- **Total tests**: 14
- **Passing**: 9 (core functionality)
- **Failing**: 5 (expected - external API network restrictions)
- **Duration**: ~0.3 seconds

### Startup Messages
```
🚀 SEO-APP - Servidor Backend y Frontend

✅ Servidor iniciado en http://localhost:3000
📊 Interfaz web disponible para crear análisis
🔧 API REST disponible en /api/seo/*

📋 Endpoints disponibles:
   GET  /api/health                    - Estado del servidor
   GET  /api/seo/reports               - Listar todos los reportes
   GET  /api/seo/report/:filename      - Obtener reporte específico
   POST /api/seo/analyze               - Crear nuevo análisis
   GET  /api/seo/download/:filename    - Descargar archivo
   DELETE /api/seo/report/:filename    - Eliminar reporte
```

---

**Remember**: Always start with `npm install && npm start` for a fresh setup, then validate the health endpoint and frontend load before making any changes.