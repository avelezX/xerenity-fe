import Link from 'next/link';
import { Container, Image } from 'react-bootstrap';
import HeaderProfileNav from '@layout/CoreLayout/Header/HeaderProfileNav';

export default function Header() {
  return (
    <header className="header sticky-top py-2 px-sm-2">
      <Container fluid className="header-navbar d-flex align-items-center">
        <Link href="/" className="header-brand d-md-none">
          <Image src="/assets/img/brand/logo.svg" alt="Xerenity Logo" />
        </Link>
        <div className="header-nav ms-2">
          <HeaderProfileNav />
        </div>
      </Container>
    </header>
  );
}
