import React from 'react'
import { AdminLayout } from '@layout'
import type { NextPage } from 'next'
import CanastaViewer from '@components/canasta/CanastaViewer'

const Home: NextPage = () => (
  
  <AdminLayout>
      <CanastaViewer />
  </AdminLayout>
)

export default Home
