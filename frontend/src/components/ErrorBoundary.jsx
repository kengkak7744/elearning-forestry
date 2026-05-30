import { Component } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Stay visible in dev; in production this is the place to forward
    // to an error tracker (Sentry/Bugsnag) once one is wired up.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('Render error:', error, info)
    }
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border/60">
          <CardContent className="space-y-3 p-8 text-center">
            <h1 className="text-xl font-semibold text-foreground">เกิดข้อผิดพลาด</h1>
            <p className="text-sm text-muted-foreground">
              ไม่สามารถแสดงหน้านี้ได้ กรุณาลองโหลดใหม่อีกครั้ง
            </p>
            <Button type="button" onClick={this.handleReload} className="mt-2">
              โหลดใหม่
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
