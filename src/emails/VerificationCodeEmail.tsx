import {
  Body,
  Container,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

/*
@ 회원가입 인증번호 메일
- 색은 프론트 globals.css 토큰과 맞춘다 (orange-400, black-300 등)
- 메일 클라이언트 호환을 위해 인라인 style 만 쓴다
*/
interface VerificationCodeEmailProps {
  code: string;
  expiresInMinutes: number;
}

const COLOR = {
  orange: '#f9502e',
  black: '#302f2d',
  gray: '#808080',
  line: '#f2f2f2',
  white: '#ffffff',
};

export default function VerificationCodeEmail({
  code,
  expiresInMinutes,
}: VerificationCodeEmailProps) {
  return (
    <Html lang="ko">
      <Preview>{`무빙 회원가입 인증번호 ${code}`}</Preview>
      <Body style={{ backgroundColor: COLOR.line, padding: '40px 0' }}>
        <Container
          style={{
            backgroundColor: COLOR.white,
            borderRadius: '16px',
            padding: '40px 32px',
            maxWidth: '480px',
          }}
        >
          <Text
            style={{
              color: COLOR.orange,
              fontSize: '24px',
              fontWeight: 700,
              margin: 0,
            }}
          >
            무빙
          </Text>
          <Heading
            as="h1"
            style={{
              color: COLOR.black,
              fontSize: '20px',
              margin: '24px 0 8px',
            }}
          >
            회원가입 인증번호
          </Heading>
          <Text style={{ color: COLOR.gray, fontSize: '14px', margin: 0 }}>
            아래 인증번호를 회원가입 화면에 입력해 주세요.
          </Text>
          <Section
            style={{
              backgroundColor: COLOR.line,
              borderRadius: '12px',
              margin: '24px 0',
              padding: '20px 0',
              textAlign: 'center',
            }}
          >
            <Text
              style={{
                color: COLOR.orange,
                fontSize: '32px',
                fontWeight: 700,
                letterSpacing: '8px',
                margin: 0,
              }}
            >
              {code}
            </Text>
          </Section>
          <Text style={{ color: COLOR.gray, fontSize: '14px', margin: 0 }}>
            인증번호는 {expiresInMinutes}분 동안 유효합니다.
          </Text>
          <Hr style={{ borderColor: COLOR.line, margin: '24px 0' }} />
          <Text style={{ color: COLOR.gray, fontSize: '12px', margin: 0 }}>
            본인이 요청하지 않았다면 이 메일을 무시해 주세요.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
