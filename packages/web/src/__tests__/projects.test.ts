import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

describe('Firestore projects collection', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-project',
      firestore: { host: 'localhost', port: 8085 }, // use emulator (avoid clashing with Vite 8080)
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('should allow creating and reading a project document', async () => {
    const user = testEnv.authenticatedContext('user_123').firestore();
    const projectRef = doc(user, 'projects', 'proj_1');

    await setDoc(projectRef, {
      name: 'Test Project',
      description: 'Created in test',
      user_id: 'user_123',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    const snap = await getDoc(projectRef);
    expect(snap.exists()).toBe(true);
    const data = snap.data();
    expect(data?.name).toBe('Test Project');
    expect(data?.user_id).toBe('user_123');
  });
});
