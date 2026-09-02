import { AuthProvider } from '../../generated/prisma/client';

export type SocialProvider = 'google' | 'kakao' | 'naver';

export type SocialProfile = {
  provider: AuthProvider;
  providerId: string;
  email?: string;
  name: string;
  phoneNumber?: string;
};
