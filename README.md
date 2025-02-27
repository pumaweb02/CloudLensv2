git clone https://github.com/pumaweb02/CloudLens.git
cd cloudlens
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/cloudlens

# API Keys (Required)
OPENAI_API_KEY=your_openai_api_key           # Get from: https://platform.openai.com
REGRID_API_KEY=your_regrid_api_key           # Get from: https://regrid.com
GOOGLE_MAPS_API_KEY=your_google_maps_api_key # Get from: https://console.cloud.google.com
WEATHERSTACK_API_KEY=your_weatherstack_api_key # Get from: https://weatherstack.com

# Optional Configuration
NODE_ENV=development                         # development or production
PORT=5000                                    # Default port for the application
```

4. Set up upload directories:
```bash
# Create upload directories with proper permissions
mkdir -p uploads/chunks uploads/thumbnails
chmod 755 uploads uploads/chunks uploads/thumbnails
```

5. Initialize the database:
```bash
# Create the database
createdb cloudlens

# Push the schema
npm run db:push
```

## Running the Application

1. Development Mode:
```bash
npm run dev
```

2. Production Mode:
```bash
npm run build
npm start
```

The application will be available at:
- Frontend: [http://localhost:5000](http://localhost:5000)
- Backend API: [http://localhost:5000/api](http://localhost:5000/api)

## Pushing to GitHub

To push your changes to GitHub:

1. Set up GitHub authentication:
   - Create a Personal Access Token (PAT) on GitHub:
     1. Go to GitHub Settings > Developer Settings > Personal Access Tokens
     2. Generate a new token with 'repo' permissions
     3. Copy the token

2. Configure git credentials:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

3. Add your changes and push:
```bash
# Add your changes
git add .

# Commit your changes
git commit -m "Your commit message"

# Push to GitHub (you'll be prompted for your PAT)
git push origin main
```

## Project Structure

```
cloudlens/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions
│   │   ├── pages/        # Application pages
│   │   └── App.tsx       # Main application component
├── db/                    # Database configuration
│   ├── migrations/       # Database migrations
│   └── schema.ts        # Drizzle ORM schema
├── server/               # Backend Express server
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── lib/            # Utility functions
└── uploads/             # File upload directory
    ├── chunks/         # Temporary upload chunks
    └── thumbnails/    # Generated thumbnails
```

## API Documentation

The following APIs are integrated into CloudLens:

- OpenAI Vision API
  - Used for: Advanced image analysis and damage detection
  - Documentation: [OpenAI API Docs](https://platform.openai.com/docs)

- Regrid API
  - Used for: Property data extraction and parcel information
  - Documentation: [Regrid API Docs](https://regrid.com/api)

- Google Maps APIs
  - Used for: Geocoding, visualization, and Street View
  - Documentation: [Google Maps Platform](https://developers.google.com/maps/documentation)

- WeatherStack API
  - Used for: Weather data integration and forecasting
  - Documentation: [WeatherStack Docs](https://weatherstack.com/documentation)


## Development Guidelines

1. Frontend Development:
   - Use `wouter` for routing
   - Implement forms with `react-hook-form` and shadcn components
   - Use `@tanstack/react-query` for data fetching
   - Follow the existing component structure in `client/src/components`

2. Backend Development:
   - Add new routes in `server/routes.ts`
   - Use Drizzle ORM for database operations
   - Follow the existing service pattern in `server/services`

3. Database Changes:
   - Add new schemas in `db/schema.ts`
   - Use `npm run db:push` to apply changes
   - Never modify the database directly

## Testing

1. Running Tests:
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "API Tests"

# Run with coverage
npm test -- --coverage
```

2. Writing Tests:
- Place tests next to the code they test
- Follow the existing test patterns
- Use meaningful test descriptions
- Include both positive and negative test cases

## Data Management

### Backup
To backup your database:
```bash
pg_dump -U username cloudlens > backup.sql
```

### Restore
To restore from a backup:
```bash
psql -U username cloudlens < backup.sql
```

### Reset Data
To clean all data and start fresh:
```bash
npm run db:reset
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/AmazingFeature`
3. Follow the code style guidelines:
   - Use ESLint and Prettier configs
   - Write meaningful commit messages
   - Add appropriate documentation
4. Test your changes thoroughly
5. Submit a pull request

## Troubleshooting

### Common Issues

1. Database Connection Issues:
   - Verify PostgreSQL is running: `sudo systemctl status postgresql`
   - Check DATABASE_URL format in .env
   - Ensure database exists: `psql -l | grep cloudlens`
   - Test connection: `psql $DATABASE_URL -c "SELECT 1;"`

2. API Key Issues:
   - Verify all required API keys are set in .env
   - Test API keys individually using curl commands
   - Check API key permissions and quotas in respective dashboards
   - Enable necessary API services in Google Cloud Console

3. Upload Issues:
   - Check directory permissions: `ls -la uploads/`
   - Verify disk space: `df -h`
   - Check upload size limits in `server/config.ts`
   - Monitor upload folder for temp files: `watch -n1 "ls -la uploads/chunks/"`

4. Performance Issues:
   - Monitor CPU/Memory: `top` or `htop`
   - Check Node.js memory usage: `node --v8-options | grep -B0 -A1 memory`
   - Monitor PostgreSQL: `pg_top`
   - Check network connectivity: `ping api.openai.com`

### Debug Mode
To run the application in debug mode with additional logging:
```bash
DEBUG=cloudlens:* npm run dev