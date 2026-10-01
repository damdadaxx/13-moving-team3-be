import { Request, Response } from 'express';

const HEARTBEAT_MS = 30_000; // 하트비트 간격

const clients = new Map<string, Set<Response>>(); // 사용자 연결 관리

const notificationSse = {
  /**
   * 사용자 연결 메시지 전송 함수
   * @param res 응답
   * @param event 이벤트
   * @param data 데이터
   */
  send: (res: Response, event: string, data: unknown) => {
    if (res.writableEnded) {
      // 연결 종료 시 종료
      return;
    }
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); // 메시지 전송
  },

  /**
   * 사용자 연결 메시지 전송 함수
   * @param userId 사용자 ID
   * @param event 이벤트
   * @param data 데이터
   */
  publish: (userId: string, event: string, data: unknown) => {
    const connections = clients.get(userId);
    if (!connections) {
      return;
    }

    for (const res of connections) {
      notificationSse.send(res, event, data); // 메시지 전송
    }
  },

  /**
   * 사용자 연결 오픈 함수
   * @param userId 사용자 ID
   * @param req 요청
   * @param res 응답
   */
  open: (userId: string, req: Request, res: Response) => {
    res.set({
      // 헤더 준비
      'Content-Type': 'text/event-stream; charset=utf-8', // SSE임을 선언
      'Cache-Control': 'no-cache, no-transform', // 캐시 금지, 중간 프록시가 gzip으로 묶지 않게
      Connection: 'keep-alive', // 연결 유지
      'X-Accel-Buffering': 'no', // Nginx 캐시 무효화
    });
    res.flushHeaders(); // 헤더 전송

    const connections = clients.get(userId) ?? new Set<Response>(); // 사용자 연결 관리
    connections.add(res); // 연결 추가
    clients.set(userId, connections); // 사용자 연결 관리

    req.socket.setTimeout(0); // 타임아웃 무시 (무한 대기)

    /** 타임아웃 방지를 위해 하트비트 설정 */
    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        return; // 연결 종료 시 종료
      }

      res.write(': heartbeat\n\n'); // 하트비트 전송
    }, HEARTBEAT_MS);

    const close = () => {
      clearInterval(heartbeat); // 하트비트 정리
      connections.delete(res);

      if (connections.size === 0) {
        clients.delete(userId); // 사용자 연결 삭제
      }
    };

    req.on('close', close); // 연결 종료 시 종료 함수 호출
  },
};

export default notificationSse;
