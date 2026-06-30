// Fixed credentials for demo
const DEMO_EMAIL = 'test@gmail.com';
const DEMO_PASSWORD = 'test@123';

export async function loginRoute(fastify) {
  fastify.post('/login', async (request, reply) => {
    let email = '', password = '';
    try {
      if (request.body && typeof request.body === 'object') {
        email = request.body.email || '';
        password = request.body.password || '';
      }
    } catch (e) {}

    if (email === 'test@gmail.com' && password === 'test@123') {
      return reply.code(200).send({
        success: true,
        user: { email }
      });
    }
    // Always return valid JSON
    return reply.code(401).send({
      success: false,
      message: 'Invalid credentials'
    });
  });
}
