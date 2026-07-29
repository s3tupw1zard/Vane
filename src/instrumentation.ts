export const register = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      console.log('Running database migrations...');
      const { migrateDatabase } = await import('./lib/db/migrate');
      await migrateDatabase();
      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Failed to run database migrations:', error);
      throw error;
    }

    await import('./lib/config/index');
  }
};
