// app/privacy-policy/page.js
import Layout from '../components/Layout';
import Link from 'next/link';
import ScrollToTopButton from '../components/ScrollToTopButton';
import styles from './PrivacyPage.module.css';

export const metadata = {
  title: 'Privacy Policy | TuneDive',
  description: 'Learn how TuneDive handles your personal information.',
};

export default function PrivacyPolicy() {
  return (
          <Layout pageTitle="Privacy Policy | TuneDive">
      <main className={styles.privacyContainer}>
        <h1>プライバシーポリシー</h1>
        <p>最終更新日: 2025.05.01</p>
        
        <section>
          <h3>サイト概要</h3>
          <p>
            音楽サイト「TuneDive」は、幅広いジャンルとスタイルの音楽を提供しています。多数のアーチストとジャンルを網羅しています。
          </p>
        </section>

        <section>
          <h3>収集する情報</h3>
          <p>
            当サイトでは、個人識別情報と非個人識別情報を収集することがあります。個人識別情報には、名前やメールアドレスなどが含まれます。非個人識別情報には、ブラウザの種類やデバイスの種類などが含まれます。
          </p>
        </section>

        <section>
          <h3>情報の使用方法</h3>
          <p>
            収集した情報は、ユーザーエクスペリエンスの向上、カスタマイズされたコンテンツの提供、ウェブサイトの改善、顧客サービスの向上などに使用されます。
          </p>
        </section>

        <section>
          <h3>情報の保護</h3>
          <p>
            当サイトは、収集した個人情報を保護するために適切なデータ収集、保管、処理の実践とセキュリティ対策を講じています。
          </p>
        </section>

        <section>
          <h3>情報の共有</h3>
          <p>
            当サイトは、ユーザーの個人情報を販売、交換、または他の企業に提供することはありませんが、法律により要求された場合には除きます。
          </p>
        </section>

        <section>
          <h3>クッキーの使用</h3>
          <p>
            当サイトは「クッキー」を使用してデータを収集することがあります。ユーザーはブラウザ設定を通じてクッキーを無効にすることができます。
          </p>
        </section>

        <section>
          <h3>第三者のリンク</h3>
          <p>
            当サイトには他のウェブサイトへのリンクが含まれていることがありますが、これらのサイトのプライバシーポリシーについて当サイトは責任を負いません。
          </p>
        </section>

        <section>
          <h3>プライバシーポリシーの変更</h3>
          <p>
            当サイトはプライバシーポリシーを更新する権利を留保します。本ポリシーは定期的に見直され、変更があった場合はこのページにその情報が掲載されます。
          </p>
        </section>

        <section>
          <h3>お問い合わせ</h3>
          <p>
            本プライバシーポリシーに関するご質問がある場合は、以下のメールアドレスまでご連絡ください。<br />
            Email: <a href="mailto:contact@tunedive.com">contact@tunedive.com</a>
          </p>
        </section>

        <hr />

        <h1>Privacy Policy</h1>
        <p>Last Updated: May 5, 2024</p>
        
        <section>
          <h2>Site Overview</h2>
          <p>
            TuneDive is a music site that offers a wide range of genres and styles. It covers numerous artists and genres.
          </p>
        </section>

        <section>
          <h2>Information We Collect</h2>
          <p>
            We collect both personally identifiable information and non-personally identifiable information through our site. Personally identifiable information may include your name and email address. Non-personally identifiable information may include your browser type and device type.
          </p>
        </section>

        <section>
          <h2>How We Use Information</h2>
          <p>
            The information we collect is used for improving user experience, providing customized content, enhancing our website, and improving customer service.
          </p>
        </section>

        <section>
          <h2>Protection of Information</h2>
          <p>
            Our site takes appropriate data collection, storage, and processing practices and security measures to protect against unauthorized access, alteration, disclosure, or destruction of your personal information.
          </p>
        </section>

        <section>
          <h3>Information Sharing</h3>
          <p>
            Our site does not sell, trade, or otherwise transfer to outside parties your personally identifiable information unless we are compelled to do so by law.
          </p>
        </section>

        <section>
          <h3>Use of Cookies</h3>
          <p>
            Our site may use "cookies" to enhance User experience. Users can choose to set their web browser to refuse cookies, or to alert them when cookies are being sent. If they do so, note that some parts of the Site may not function properly.
          </p>
        </section>

        <section>
          <h3>Third-Party Links</h3>
          <p>
            Our site may contain links to other websites. Please be aware that we are not responsible for the privacy practices of such other sites. We encourage our users to be aware when they leave our site and to read the privacy statements of any other site that collects personally identifiable information.
          </p>
        </section>

        <section>
          <h3>Privacy Policy Changes</h3>
          <p>
            We reserve the right to update or change our Privacy Policy at any time. Any changes to this privacy policy will be posted on this page.
          </p>
        </section>

        <section>
          <h3>Contact Us</h3>
          <p>
            If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:contact@tunedive.com">contact@tunedive.com</a>
          </p>
        </section>
      </main>
      <ScrollToTopButton />
    </Layout>
  );
}
