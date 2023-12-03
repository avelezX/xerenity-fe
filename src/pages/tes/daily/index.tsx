import React from 'react'
import { AdminLayout } from '@layout'
import type { NextPage } from 'next'
import FullTesViewer from '@components/Tes/Viewer/FullTesViewer'


const Home: NextPage = () => (  
  <AdminLayout>
      <FullTesViewer />
  </AdminLayout>
)

export default Home
