import { isIP } from 'net';
import type { Request } from 'express';
import { ENV } from '../config/env';
import { isSameSecret } from './hash';

/*=================================================
요청한 사용자의 실제 IP
=================================================*/
/*
@ 가이드
- 브라우저 → 프론트 BFF 프록시 → 백엔드 구조라 req.ip 는 항상 프록시 서버 IP 다
- 프록시가 사용자 IP 를 X-Client-IP 로, 공유 시크릿을 X-Proxy-Secret 으로 보낸다
- 시크릿이 일치할 때만 X-Client-IP 를 믿고, 아니면 req.ip 를 쓴다
@ 주의사항
- 시크릿 없이 온 IP 헤더는 누구나 위조할 수 있으므로 무시한다
  (trust proxy 로 X-Forwarded-For 를 믿는 방식은 배포 구조·헤더 위조에 취약해 쓰지 않는다)
- PROXY_SECRET 은 프록시와 백엔드 환경변수에만 둔다
*/
const PROXY_SECRET_HEADER = 'x-proxy-secret';
const CLIENT_IP_HEADER = 'x-client-ip';

export const getClientIp = (req: Request): string => {
  const secret = req.get(PROXY_SECRET_HEADER);
  const clientIp = req.get(CLIENT_IP_HEADER)?.trim();

  if (
    ENV.PROXY_SECRET &&
    secret &&
    clientIp &&
    isIP(clientIp) &&
    isSameSecret(secret, ENV.PROXY_SECRET)
  ) {
    return clientIp;
  }

  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};
