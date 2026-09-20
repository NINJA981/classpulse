import mongoose from 'mongoose';

let memoryServer: any = null;

export async function connectDB(): Promise<string> {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/classpulse';
  
  try {
    console.log(`[Database] Attempting connection to MongoDB at: ${uri}`);
    // Set a fast connection timeout so we fall back quickly if local daemon isn't running
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
    console.log(`[Database] Connected successfully to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return uri;
  } catch (error: any) {
    console.warn(`[Database] Could not connect to primary MongoDB (${error.message}).`);
    
    // In development or local testing, automatically start mongodb-memory-server
    try {
      console.log('[Database] Starting in-memory MongoDB fallback server...');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create({
        instance: { dbName: 'classpulse' }
      });
      const memoryUri = memoryServer.getUri();
      await mongoose.connect(memoryUri);
      console.log(`[Database] In-memory MongoDB running and connected at: ${memoryUri}`);
      return memoryUri;
    } catch (fallbackError: any) {
      console.error('[Database] Failed to launch MongoDB fallback:', fallbackError.message);
      throw fallbackError;
    }
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
}

