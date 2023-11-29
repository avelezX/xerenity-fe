import React, {
  PropsWithChildren, useCallback, useEffect, useState,
} from 'react'
import { useResizeDetector } from 'react-resize-detector'
import Head from 'next/head'
import { Container } from 'react-bootstrap'
import Sidebar, { SidebarOverlay } from '@layout/AdminLayout/Sidebar/Sidebar'
import Header from '@layout/AdminLayout/Header/Header'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { deleteCookie, getCookie} from 'cookies-next'
import { useRouter } from 'next/router'

export default function AdminLayout({ children }: PropsWithChildren) {
  // Show status for xs screen
  const router = useRouter()
  const [isShowSidebar, setIsShowSidebar] = useState(false)

  // Show status for md screen and above
  const [isShowSidebarMd, setIsShowSidebarMd] = useState(true)

  const supabase = createClientComponentClient()

  const getRedirect = () => {
    const redirect = getCookie('redirect')
    if (redirect) {
      deleteCookie('redirect')
      return redirect.toString()
    }

    return '/'
  }

  const toggleIsShowSidebar = () => {
    setIsShowSidebar(!isShowSidebar)
  }

  const toggleIsShowSidebarMd = () => {
    const newValue = !isShowSidebarMd
    localStorage.setItem('isShowSidebarMd', newValue ? 'true' : 'false')
    setIsShowSidebarMd(newValue)
  }

  // Clear and reset sidebar
  const resetIsShowSidebar = () => {
    setIsShowSidebar(false)
  }

  const onResize = useCallback(() => {
    resetIsShowSidebar()
  }, [])

  const { ref } = useResizeDetector({ onResize })


  // On first time load only
  useEffect(() => {
    if (localStorage.getItem('isShowSidebarMd')) {
      setIsShowSidebarMd(localStorage.getItem('isShowSidebarMd') === 'true')
    }
  }, [setIsShowSidebarMd])

  const checkUserLogedIn = useCallback( async () =>{
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push(getRedirect())
    }
  },[supabase,router])

  useEffect(() => {
    checkUserLogedIn()
  }, [checkUserLogedIn])

  return (
    <>
      <Head>
        <title>Xerenity</title>
        <meta name="description" content="Xerenity Financial tools" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div ref={ref} className="position-absolute" />

      <Sidebar isShow={isShowSidebar} isShowMd={isShowSidebarMd} />

      <div className="wrapper d-flex flex-column min-vh-100 bg-light">
        <Header toggleSidebar={toggleIsShowSidebar} toggleSidebarMd={toggleIsShowSidebarMd} />
        <div className="body flex-grow-1 px-sm-2 mb-4">
          <Container>
            {children}
          </Container>
        </div>
      </div>

      <SidebarOverlay isShowSidebar={isShowSidebar} toggleSidebar={toggleIsShowSidebar} />
    </>
  )
}
