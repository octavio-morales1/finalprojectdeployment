import { users } from '@/lib/mongoCollections';
import { NextApiRequest, NextApiResponse } from 'next';
import { decrypt } from '../../../../lib/sessions';
import { ObjectId } from 'mongodb';
import redis from '@/lib/redis';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {


      const rawCookies = req.headers.cookie || '';
      const cookies = parseCookies(rawCookies);

      const session = cookies.session;
      if (!session) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No session found' });
      }
      const sessionData = await decrypt(session);
      
      if (!sessionData || !sessionData.userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid session' });
      }

      const cachedUser = await redis.get(`user/${sessionData.userId}`);
      if (cachedUser) {
        return res.status(200).json({ success: true, user: cachedUser });
      }

      const usersCollection = await users();
      const objId = new ObjectId(sessionData.userId)
      const user = await usersCollection.findOne({ _id: objId });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      redis.set(`user/${sessionData.userId}`, user);

      res.status(200).json({ success: true, user });
    } catch (error: any) {
      console.error('Error fetching user:', error.message);
      res.status(500).json({ success: false, message: 'Failed to fetch user' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
}

// Utility function to parse cookies
function parseCookies(cookieString: string) {
  return cookieString.split(';').reduce((acc: Record<string, string>, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}
