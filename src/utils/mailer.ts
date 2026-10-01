import nodemailer, { Transporter } from 'nodemailer';
import { ENV } from '../config/env';

/*
@ 메일 발송
- SMTP 설정(SMTP_HOST 등)이 있으면 실제로 보낸다.
- 설정이 없으면 개발 편의를 위해 콘솔에 내용을 찍고 끝낸다.
  (로컬에서 SMTP 계정 없이도 회원가입 인증 흐름을 확인할 수 있게 한다)
- 운영에서는 SMTP 설정이 없으면 시작 시점에 알 수 있도록 경고를 남긴다.
*/
let transporter: Transporter | null = null;

const isSmtpConfigured = () =>
  Boolean(ENV.SMTP_HOST && ENV.SMTP_USER && ENV.SMTP_PASSWORD);

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_PORT === 465,
      auth: { user: ENV.SMTP_USER, pass: ENV.SMTP_PASSWORD },
    });
  }
  return transporter;
};

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
}

export const sendMail = async ({ to, subject, text }: SendMailInput) => {
  if (!isSmtpConfigured()) {
    if (ENV.NODE_ENV === 'production') {
      console.warn('[mailer] SMTP 설정이 없어 메일을 보내지 못했습니다.', {
        to,
        subject,
      });
      return;
    }

    console.info('[mailer] SMTP 미설정 — 메일 내용을 콘솔에 출력합니다.');
    console.info(`[mailer] to=${to} subject=${subject}\n${text}`);
    return;
  }

  await getTransporter().sendMail({
    from: ENV.SMTP_FROM ?? ENV.SMTP_USER,
    to,
    subject,
    text,
  });
};
