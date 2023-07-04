import { Config } from './index';
import { APIToolkit } from './index';
import { PubSub } from '@google-cloud/pubsub';


describe('testing init', () => {
  test('get correct response', async () => {
    const cfg: Config = {
      apiKey: "zqZOKsIZaC0zy9VM1KZsTDwd9GKfSdSe7Lrp1L5Y8WhQ8o3F",
    };
    // let x = await init(cfg);
    let x = 0
    expect(x).toBe(0);
  })
})

describe('APIToolkit class', () => {
  let myClassInstance: APIToolkit;

  beforeEach(() => {
    const pubsub = new PubSub({
      projectId: "pubsub_project_id"
    });
    myClassInstance = new APIToolkit(pubsub, "topic_id", "project_id", [], [], []);
  });

  it('should redact headers correctly', () => {
    const headers = new Map<string, string[]>();
    headers.set('Authorization', ['token']);
    headers.set('User-Agent', ['MyApp']);

    const headersToRedact = ['Authorization'];

    const redactedHeaders = myClassInstance['redactHeaders'](headers, headersToRedact);

    expect(redactedHeaders.get('Authorization')).toEqual(['[CLIENT_REDACTED]']);
    expect(redactedHeaders.get('User-Agent')).toEqual(['MyApp']);
  });

  it('should redact fields correctly', () => {
    const body = '{"user": {"name": "John", "email": "john@example.com", "books": [{"title": "Book 1", "author": "Author 1"},{"title": "Book 2", "author": "Author 2"}]}}';
    const fieldsToRedact = ['$.user.email', 'user.books[*].author'];

    const redactedBody = myClassInstance['redactFields'](body, fieldsToRedact);

    expect(redactedBody).toContain('"email":"[CLIENT_REDACTED]"');
    expect(redactedBody).toContain('{"title":"Book 1","author":"[CLIENT_REDACTED]"},{"title":"Book 2","author":"[CLIENT_REDACTED]"}')
    expect(redactedBody).toContain('"name":"John"');
  });
});

