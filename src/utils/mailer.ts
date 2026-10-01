import { ReactElement } from 'react';
import { Resend } from 'resend';
import { ENV } from '../config/env';

/*
@ 메일 발송 (Resend)
- RESEND_API_KEY 가 있으면 실제로 보낸다.
  보내는 주소(MAIL_FROM)는 Resend 에서 인증한 도메인(moving-team3.xyz) 이어야 한다.
- 설정이 없으면 개발 편의를 위해 콘솔에 내용을 찍고 끝낸다.
  (로컬에서 API 키 없이도 회원가입 인증 흐름을 확인할 수 있게 한다)
- 운영에서는 설정이 없으면 경고를 남긴다.
- react 는 HTML 본문(React Email 템플릿), text 는 HTML 을 못 보는 클라이언트용 본문이다.
*/
let resend: Resend | null = null;

const getResend = () => {
  if (!resend) {
    resend = new Resend(ENV.RESEND_API_KEY);
  }
  return resend;
};

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  react?: ReactElement;
}

export const sendMail = async ({ to, subject, text, react }: SendMailInput) => {
  if (!ENV.RESEND_API_KEY) {
    if (ENV.NODE_ENV === 'production') {
      console.warn('[mailer] Resend 설정이 없어 메일을 보내지 못했습니다.', {
        to,
        subject,
      });
      return;
    }

    console.info('[mailer] Resend 미설정 — 메일 내용을 콘솔에 출력합니다.');
    console.info(`[mailer] to=${to} subject=${subject}\n${text}`);
    return;
  }

  // Resend SDK 는 실패해도 throw 하지 않고 error 를 돌려준다
  const { error } = await getResend().emails.send({
    from: ENV.MAIL_FROM,
    to,
    subject,
    text,
    ...(react && { react }),
  });

  if (error) {
    throw new Error(`[mailer] 메일 발송 실패: ${error.message}`);
  }
};
