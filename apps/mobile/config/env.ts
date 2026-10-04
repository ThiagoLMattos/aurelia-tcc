/**
 * Aurélia — Environment configuration
 *
 * USE_MOCK: true  → all services return local mock data (development)
 * USE_MOCK: false → all services hit the real REST API (production)
 *
 * To switch to the real backend:
 *   1. Set USE_MOCK = false
 *   2. Set API_BASE_URL to your deployed backend URL
 *   3. Implement any missing API service methods (they'll throw until filled in)
 */

export const USE_MOCK = true;

export const API_BASE_URL = 'http://localhost:3000/api';
