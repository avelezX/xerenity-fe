import Image from 'next/image';

export default function HeaderProfileNav() {
  return (
    <div className="avatar position-relative">
      <Image
        fill
        className="rounded-circle"
        src="/assets/img/avatars/8.jpg"
        alt="user@email.com"
      />
    </div>
  );
}
